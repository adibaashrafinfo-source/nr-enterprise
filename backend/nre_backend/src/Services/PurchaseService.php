<?php
declare(strict_types=1);

final class PurchaseService
{
    private static function header(array $d, bool $creating): array
    {
        $v = new V($d);
        $sup = $v->int('supplier_id', $creating, 1);
        $date = $v->date('order_date') ?? date('Y-m-d');
        $exp = $v->date('expected_date');
        $bill = $v->str('bill_no', false, 0, 80);
        $notes = $v->str('notes', false, 0, 2000);
        $v->done();
        if ($sup && !Db::one('SELECT id FROM suppliers WHERE id=?', [$sup])) throw new ApiException('VALIDATION', 'Supplier not found', 422, ['supplier_id' => 'Not found']);
        $h = ['order_date' => $date, 'expected_date' => $exp, 'bill_no' => $bill, 'notes' => $notes];
        if ($sup) $h['supplier_id'] = $sup;
        return $h;
    }
    private static function items(mixed $items): array
    {
        if (!is_array($items) || !$items) throw new ApiException('VALIDATION', 'At least one item is required', 422, ['items' => 'Required']);
        $rows = []; $errors = [];
        foreach (array_values($items) as $i => $it) {
            $v = new V(is_array($it) ? $it : []);
            $vid = $v->int('variant_id', true, 1); $q = $v->num('qty_ordered', true, 0.001); $rate = $v->num('rate', true, 0);
            try { $v->done(); } catch (ApiException $e) { foreach ($e->fields as $k => $m) $errors["items.$i.$k"] = $m; continue; }
            if (!Db::one('SELECT id FROM product_variants WHERE id=?', [$vid])) { $errors["items.$i.variant_id"] = 'Not found'; continue; }
            $rows[] = ['variant_id' => $vid, 'qty_ordered' => $q, 'rate' => $rate];
        }
        if ($errors) throw new ApiException('VALIDATION', 'Please correct the item rows', 422, $errors);
        return $rows;
    }
    private static function recalc(int $id): void
    {
        Db::exec('UPDATE purchase_orders po SET total=(SELECT COALESCE(SUM(line_total),0) FROM purchase_order_items WHERE po_id=po.id) WHERE po.id=?', [$id]);
    }
    public static function create(array $d): int
    {
        $h = self::header($d, true); $items = self::items($d['items'] ?? null);
        return Db::tx(function () use ($h, $items, $d) {
            $h['po_no'] = Numbering::next('purchase'); $h['status'] = (($d['status'] ?? '') === 'ordered') ? 'ordered' : 'draft'; $h['created_by'] = Auth::id();
            $id = Db::insert('purchase_orders', $h);
            foreach ($items as $r) Db::insert('purchase_order_items', ['po_id' => $id] + $r);
            self::recalc($id);
            Audit::log('purchase_orders', 'INSERT', $id);
            return $id;
        });
    }
    public static function update(int $id, array $d): void
    {
        $items = self::items($d['items'] ?? null);
        Db::tx(function () use ($id, $d, $items) {
            $po = needRow(Db::one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [$id]), 'Purchase order');
            if (!in_array($po['status'], ['draft', 'ordered'], true) || (float)Db::val('SELECT COALESCE(SUM(qty_received),0) FROM purchase_order_items WHERE po_id=?', [$id]) > 0)
                throw new ApiException('LOCKED', 'This purchase order can no longer be edited', 409);
            Db::update('purchase_orders', $id, self::header($d + ['supplier_id' => $po['supplier_id']], false));
            Db::exec('DELETE FROM purchase_order_items WHERE po_id=?', [$id]);
            foreach ($items as $r) Db::insert('purchase_order_items', ['po_id' => $id] + $r);
            self::recalc($id);
            Audit::log('purchase_orders', 'UPDATE', $id);
        });
    }
    public static function setStatus(int $id, string $to): void
    {
        Db::tx(function () use ($id, $to) {
            $po = needRow(Db::one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [$id]), 'Purchase order');
            $received = (float)Db::val('SELECT COALESCE(SUM(qty_received),0) FROM purchase_order_items WHERE po_id=?', [$id]);
            $ok = ($to === 'ordered' && $po['status'] === 'draft') || ($to === 'cancelled' && $received == 0 && in_array($po['status'], ['draft', 'ordered'], true));
            if (!$ok) throw new ApiException('BAD_TRANSITION', "Cannot change status from {$po['status']} to $to", 409);
            Db::update('purchase_orders', $id, ['status' => $to]);
            Audit::log('purchase_orders', 'STATUS', $id, ['to' => $to]);
        });
    }
    private static function refreshStatus(int $poId): void
    {
        $open = (int)Db::val('SELECT COUNT(*) FROM purchase_order_items WHERE po_id=? AND qty_received < qty_ordered', [$poId]);
        $any = (float)Db::val('SELECT COALESCE(SUM(qty_received),0) FROM purchase_order_items WHERE po_id=?', [$poId]);
        $status = $open === 0 ? 'received' : ($any > 0 ? 'partial' : 'ordered');
        Db::update('purchase_orders', $poId, ['status' => $status]);
    }
    public static function receive(int $itemId, string $qty, ?string $batch, ?string $note): array
    {
        return Db::tx(function () use ($itemId, $qty, $batch, $note) {
            $it = needRow(Db::one('SELECT * FROM purchase_order_items WHERE id=? FOR UPDATE', [$itemId]), 'Purchase item');
            $po = needRow(Db::one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [$it['po_id']]), 'Purchase order');
            if (!in_array($po['status'], ['ordered', 'partial'], true)) throw new ApiException('NOT_RECEIVABLE', 'This purchase order is not open for receiving', 409);
            $pending = (float)$it['qty_ordered'] - (float)$it['qty_received'];
            if (Money::cmp3($qty, 0) <= 0 || Money::cmp3($qty, $pending) > 0)
                throw new ApiException('INVALID_QUANTITY', 'Invalid quantity: pending is ' . rtrim(rtrim(number_format($pending, 3, '.', ''), '0'), '.'), 409, ['quantity' => 'Max ' . $pending]);
            StockService::lock((int)$it['variant_id']);
            Db::exec('UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id=?', [$qty, $itemId]);
            StockService::post((int)$it['variant_id'], 'purchase_in', $qty, 'purchase_order', (int)$po['id'], $note ?: 'Received on ' . $po['po_no'], null, null, $batch);
            self::refreshStatus((int)$po['id']);
            Audit::log('purchase_orders', 'RECEIVE', $po['id'], ['item' => $itemId, 'quantity' => $qty]);
            $q = Db::one('SELECT qty_ordered, qty_received FROM purchase_order_items WHERE id=?', [$itemId]);
            return ['item_id' => $itemId, 'qty_received' => Shape::dec($q['qty_received'], 3), 'qty_pending' => Shape::dec((float)$q['qty_ordered'] - (float)$q['qty_received'], 3), 'status' => Db::val('SELECT status FROM purchase_orders WHERE id=?', [$po['id']])];
        });
    }
    public static function returnItem(int $itemId, string $qty, ?string $note): array
    {
        return Db::tx(function () use ($itemId, $qty, $note) {
            $it = needRow(Db::one('SELECT * FROM purchase_order_items WHERE id=? FOR UPDATE', [$itemId]), 'Purchase item');
            $po = needRow(Db::one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [$it['po_id']]), 'Purchase order');
            if (Money::cmp3($qty, 0) <= 0 || Money::cmp3($qty, $it['qty_received']) > 0) throw new ApiException('INVALID_QUANTITY', 'Return quantity exceeds received quantity', 409, ['quantity' => 'Max ' . $it['qty_received']]);
            StockService::lock((int)$it['variant_id']);
            if (Money::cmp3(StockService::onHand((int)$it['variant_id']), $qty) < 0) throw new ApiException('NEGATIVE_STOCK', 'Not enough stock on hand to return', 409);
            Db::exec('UPDATE purchase_order_items SET qty_received = qty_received - ? WHERE id=?', [$qty, $itemId]);
            StockService::post((int)$it['variant_id'], 'purchase_return_out', '-' . $qty, 'purchase_order', (int)$po['id'], $note ?: 'Return on ' . $po['po_no']);
            if ($po['status'] === 'received') Db::update('purchase_orders', (int)$po['id'], ['status' => 'partial']);
            else self::refreshStatus((int)$po['id']);
            Audit::log('purchase_orders', 'RETURN', $po['id'], ['item' => $itemId, 'quantity' => $qty]);
            $q = Db::one('SELECT qty_ordered, qty_received FROM purchase_order_items WHERE id=?', [$itemId]);
            return ['item_id' => $itemId, 'qty_received' => Shape::dec($q['qty_received'], 3), 'qty_pending' => Shape::dec((float)$q['qty_ordered'] - (float)$q['qty_received'], 3), 'status' => Db::val('SELECT status FROM purchase_orders WHERE id=?', [$po['id']])];
        });
    }
    public static function supplierPayment(int $supplierId, array $d): int
    {
        $v = new V($d);
        $date = $v->date('payment_date') ?? date('Y-m-d');
        $method = $v->enum('method', PaymentService::METHODS, false, 'cash');
        $ref = $v->str('reference_no', false, 0, 80); $amount = $v->num('amount', true, 0.01);
        $poId = $v->int('purchase_id', false, 1) ?? $v->int('po_id', false, 1); $note = $v->str('note', false, 0, 500);
        $v->done();
        needRow(Db::one('SELECT id FROM suppliers WHERE id=?', [$supplierId]), 'Supplier');
        if ($poId && !Db::one('SELECT id FROM purchase_orders WHERE id=? AND supplier_id=?', [$poId, $supplierId])) throw new ApiException('VALIDATION', 'Purchase order does not belong to this supplier', 422, ['po_id' => 'Invalid']);
        return Db::tx(function () use ($supplierId, $date, $method, $ref, $amount, $poId, $note) {
            $id = Db::insert('supplier_payments', ['voucher_no' => Numbering::next('voucher'), 'supplier_id' => $supplierId, 'po_id' => $poId, 'payment_date' => $date,
                'method' => $method, 'reference_no' => $ref, 'amount' => $amount, 'note' => $note, 'created_by' => Auth::id()]);
            Audit::log('supplier_payments', 'INSERT', $id, ['amount' => $amount]);
            return $id;
        });
    }
    public static function get(int $id): array
    {
        $po = needRow(Db::one(Shape::PURCHASE_SELECT . ' WHERE po.id=?', [$id]), 'Purchase order');
        $out = Shape::purchaseRow($po);
        $out['items'] = array_map(fn($i) => ['id' => (int)$i['id'], 'variant_id' => (int)$i['variant_id'], 'display_name' => $i['display_name'], 'sku' => $i['sku'], 'unit_code' => $i['unit_code'],
            'qty_ordered' => Shape::dec($i['qty_ordered'], 3), 'qty_received' => Shape::dec($i['qty_received'], 3), 'rate' => Shape::dec($i['rate']), 'line_total' => Shape::dec($i['line_total'])],
            Db::all('SELECT i.*, v.sku, COALESCE(v.name,p.name) AS display_name, p.unit_code FROM purchase_order_items i JOIN product_variants v ON v.id=i.variant_id JOIN products p ON p.id=v.product_id WHERE i.po_id=? ORDER BY i.id', [$id]));
        $out['payments'] = array_map([Shape::class, 'supplierPayment'], Db::all(Shape::SPAY_SELECT . ' WHERE sp.po_id=? ORDER BY sp.payment_date, sp.id', [$id]));
        $out['supplier'] = Shape::supplierById((int)$po['supplier_id']);
        $out['company'] = Shape::company();
        return $out;
    }
}
