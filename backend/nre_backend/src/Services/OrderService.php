<?php
declare(strict_types=1);

final class OrderService
{
    private const NEXT = ['quotation' => ['confirmed', 'cancelled'], 'confirmed' => ['delivered', 'cancelled'], 'delivered' => ['cancelled']];

    private static function header(array $d, bool $creating): array
    {
        $v = new V($d);
        $customer = $v->int('customer_id', $creating, 1);
        $date = $v->date('order_date') ?? date('Y-m-d');
        $del = $v->date('delivery_date');
        $buyer = $v->str('buyer_ref', false, 0, 160); $po = $v->str('po_no', false, 0, 80); $style = $v->str('style_no', false, 0, 80);
        $disc = $v->num('discount', false, 0) ?? '0';
        $notes = $v->str('notes', false, 0, 2000);
        $enq = $v->int('enquiry_id', false, 1);
        $v->done();
        if ($customer && !Db::one('SELECT id FROM customers WHERE id=?', [$customer])) throw new ApiException('VALIDATION', 'Customer not found', 422, ['customer_id' => 'Not found']);
        $h = ['order_date' => $date, 'delivery_date' => $del, 'buyer_ref' => $buyer, 'po_no' => $po, 'style_no' => $style, 'discount' => $disc, 'notes' => $notes];
        if ($customer) $h['customer_id'] = $customer;
        if ($enq) $h['enquiry_id'] = $enq;
        return $h;
    }
    public static function recalc(int $id): void
    {
        Db::exec('UPDATE sales_orders o SET subtotal=(SELECT COALESCE(SUM(amount),0) FROM sales_order_items WHERE order_id=o.id) WHERE o.id=?', [$id]);
        Db::exec('UPDATE sales_orders SET total=GREATEST(subtotal-discount,0) WHERE id=?', [$id]);
    }
    public static function create(array $d): int
    {
        $h = self::header($d, true);
        $items = LineItems::normalize($d['items'] ?? null);
        return Db::tx(function () use ($h, $items) {
            $h['order_no'] = Numbering::next('order'); $h['status'] = 'quotation'; $h['created_by'] = Auth::id();
            $id = Db::insert('sales_orders', $h);
            foreach ($items as $r) Db::insert('sales_order_items', ['order_id' => $id] + $r);
            self::recalc($id);
            Audit::log('sales_orders', 'INSERT', $id);
            return $id;
        });
    }
    public static function update(int $id, array $d): void
    {
        $items = LineItems::normalize($d['items'] ?? null);
        Db::tx(function () use ($id, $d, $items) {
            $o = needRow(Db::one('SELECT * FROM sales_orders WHERE id=? FOR UPDATE', [$id]), 'Order');
            if (!in_array($o['status'], ['quotation', 'confirmed'], true)) throw new ApiException('LOCKED', 'Only quotation or confirmed orders can be edited', 409);
            Db::update('sales_orders', $id, self::header($d + ['customer_id' => $o['customer_id']], false));
            Db::exec('DELETE FROM sales_order_items WHERE order_id=?', [$id]);
            foreach ($items as $r) Db::insert('sales_order_items', ['order_id' => $id] + $r);
            self::recalc($id);
            Audit::log('sales_orders', 'UPDATE', $id);
        });
    }
    public static function setStatus(int $id, string $to): void
    {
        Db::tx(function () use ($id, $to) {
            $o = needRow(Db::one('SELECT * FROM sales_orders WHERE id=? FOR UPDATE', [$id]), 'Order');
            if (!in_array($to, self::NEXT[$o['status']] ?? [], true)) throw new ApiException('BAD_TRANSITION', "Cannot change status from {$o['status']} to $to", 409);
            if ($to === 'cancelled' && !Auth::isManager()) throw new ApiException('FORBIDDEN', 'Only a manager can cancel an order', 403);
            Db::update('sales_orders', $id, ['status' => $to]);
            Audit::log('sales_orders', 'STATUS', $id, ['to' => $to]);
        });
    }
    public static function convert(int $id): int
    {
        return Db::tx(function () use ($id) {
            $o = needRow(Db::one('SELECT * FROM sales_orders WHERE id=? FOR UPDATE', [$id]), 'Order');
            if (in_array($o['status'], ['invoiced', 'cancelled'], true)) throw new ApiException('BAD_TRANSITION', 'This order cannot be converted', 409);
            $s = Db::one('SELECT tax_enabled, tax_rate FROM company_settings WHERE id=1');
            $inv = Db::insert('invoices', [
                'invoice_no' => Numbering::next('invoice'), 'customer_id' => $o['customer_id'], 'order_id' => $id, 'invoice_date' => date('Y-m-d'),
                'status' => 'draft', 'buyer_ref' => $o['buyer_ref'], 'po_no' => $o['po_no'], 'style_no' => $o['style_no'], 'discount' => $o['discount'],
                'tax_rate' => ($s && (int)$s['tax_enabled']) ? $s['tax_rate'] : '0', 'notes' => $o['notes'], 'created_by' => Auth::id(),
            ]);
            foreach (Db::all('SELECT * FROM sales_order_items WHERE order_id=? ORDER BY sort_order, id', [$id]) as $it)
                Db::insert('invoice_items', ['invoice_id' => $inv, 'variant_id' => $it['variant_id'], 'description' => $it['description'], 'unit_code' => $it['unit_code'],
                    'quantity' => $it['quantity'], 'rate' => $it['rate'], 'discount_percent' => $it['discount_percent'], 'sort_order' => $it['sort_order']]);
            InvoiceService::recalc($inv);
            Audit::log('invoices', 'FROM_ORDER', $inv, ['order' => $id]);
            return $inv;
        });
    }
    public static function row(array $o): array
    {
        return ['id' => (int)$o['id'], 'order_no' => $o['order_no'], 'customer_id' => (int)$o['customer_id'], 'customer_name' => $o['customer_name'], 'order_date' => $o['order_date'], 'delivery_date' => $o['delivery_date'],
            'buyer_ref' => $o['buyer_ref'], 'po_no' => $o['po_no'], 'style_no' => $o['style_no'], 'discount' => Shape::dec($o['discount']), 'notes' => $o['notes'], 'status' => $o['status'],
            'subtotal' => Shape::dec($o['subtotal']), 'total' => Shape::dec($o['total']), 'invoice_id' => $o['invoice_id'] !== null ? (int)$o['invoice_id'] : null];
    }
    public const SELECT = 'SELECT o.*, c.name AS customer_name, (SELECT id FROM invoices i WHERE i.order_id=o.id AND i.status<>\'cancelled\' ORDER BY i.id DESC LIMIT 1) AS invoice_id FROM sales_orders o JOIN customers c ON c.id=o.customer_id';
    public static function get(int $id): array
    {
        $o = needRow(Db::one(self::SELECT . ' WHERE o.id=?', [$id]), 'Order');
        $out = self::row($o);
        $out['items'] = array_map([Shape::class, 'line'], Db::all('SELECT it.* FROM sales_order_items it WHERE it.order_id=? ORDER BY it.sort_order, it.id', [$id]));
        $out['company'] = Shape::company();
        return $out;
    }
}
