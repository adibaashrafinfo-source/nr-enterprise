<?php
declare(strict_types=1);

final class CatalogueService
{
    public const PUBLIC_COLS = 'p.id, p.slug, p.name, p.code, p.short_description, p.description, p.features, p.specs, p.unit_code, p.moq, p.is_featured, c.slug AS category_slug, c.name AS category_name';

    public static function images(array $productIds): array
    {
        if (!$productIds) return [];
        $in = implode(',', array_fill(0, count($productIds), '?'));
        $out = [];
        foreach (Db::all("SELECT id, product_id, url, alt, sort_order, is_primary FROM product_images WHERE product_id IN ($in) ORDER BY is_primary DESC, sort_order, id", $productIds) as $im) $out[$im['product_id']][] = $im;
        return $out;
    }
    public static function variantsOf(int $productId, bool $withPrices, bool $withCost): array
    {
        $cols = 'v.id, v.product_id, v.sku, COALESCE(v.name,p.name) AS name, v.color, v.size, v.material, v.pack_size, COALESCE(v.selling_price,p.selling_price,0) AS selling_price, v.reorder_level, COALESCE(b.qty_on_hand,0) AS stock_qty, v.is_active';
        if ($withCost) $cols .= ', vc.purchase_price';
        $join = $withCost ? 'LEFT JOIN variant_costs vc ON vc.variant_id=v.id' : '';
        $rows = Db::all("SELECT $cols FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN v_stock_balance b ON b.variant_id=v.id $join WHERE v.product_id=? ORDER BY v.id", [$productId]);
        return array_map(fn($r) => ['id' => (int)$r['id'], 'product_id' => (int)$r['product_id'], 'sku' => $r['sku'], 'name' => $r['name'], 'color' => $r['color'], 'size' => $r['size'], 'material' => $r['material'],
            'pack_size' => $r['pack_size'], 'selling_price' => Shape::dec($r['selling_price']), 'reorder_level' => Shape::dec($r['reorder_level'], 3), 'stock_qty' => Shape::dec($r['stock_qty'], 3), 'is_active' => $r['is_active']]
            + ($withCost ? ['purchase_price' => $r['purchase_price'] !== null ? Shape::dec($r['purchase_price'], 4) : null] : []), $rows);
    }
    public static function variantById(int $id, bool $withCost): array
    {
        $pid = (int)Db::val('SELECT product_id FROM product_variants WHERE id=?', [$id]);
        foreach (self::variantsOf($pid, true, $withCost) as $v) if ($v['id'] === $id) return $v;
        throw new ApiException('NOT_FOUND', 'Variant not found', 404);
    }
    public static function saveVariant(?int $id, int $productId, array $d, bool $canCost): int
    {
        $v = new V($d);
        $sku = $v->str('sku', false, 1, 60); $name = $v->str('name', false, 0, 200);
        $color = $v->str('color', false, 0, 60); $size = $v->str('size', false, 0, 60); $mat = $v->str('material', false, 0, 80); $pack = $v->str('pack_size', false, 0, 60);
        $price = $v->num('selling_price', false, 0); $reorder = $v->num('reorder_level', false, 0) ?? '0';
        $active = $v->bool('is_active', true);
        $cost = $canCost ? $v->num('purchase_price', false, 0) : null;
        $v->done();
        $row = ['name' => $name, 'color' => $color, 'size' => $size, 'material' => $mat, 'pack_size' => $pack, 'selling_price' => $price, 'reorder_level' => $reorder, 'is_active' => $active];
        if (isset($d['attributes']) && is_array($d['attributes'])) $row['attributes'] = jsonCol($d['attributes']);
        return Db::tx(function () use ($id, $productId, $sku, $row, $cost) {
            if ($id === null) {
                if (!$sku) {
                    $p = Db::one('SELECT code, slug FROM products WHERE id=?', [$productId]);
                    $base = strtoupper($p['code'] ?: substr(preg_replace('/[^a-z0-9]/i', '', $p['slug']), 0, 8));
                    $n = (int)Db::val('SELECT COUNT(*) FROM product_variants WHERE product_id=?', [$productId]) + 1;
                    do { $sku = $base . '-' . str_pad((string)$n, 2, '0', STR_PAD_LEFT); $n++; } while (Db::val('SELECT COUNT(*) FROM product_variants WHERE sku=?', [$sku]) > 0);
                }
                $id = Db::insert('product_variants', $row + ['product_id' => $productId, 'sku' => $sku]);
            } else {
                if ($sku) $row['sku'] = $sku;
                Db::update('product_variants', $id, $row);
            }
            if ($cost !== null) Db::exec('INSERT INTO variant_costs (variant_id, purchase_price) VALUES (?,?) ON DUPLICATE KEY UPDATE purchase_price=VALUES(purchase_price)', [$id, $cost]);
            Audit::log('product_variants', $id === null ? 'INSERT' : 'UPSERT', $id, ['cost_changed' => $cost !== null]);
            return $id;
        });
    }
}
