<?php
declare(strict_types=1);

final class LineItems
{
    /** validate + normalise item rows for orders/invoices. Returns rows ready to insert (without parent id). */
    public static function normalize(mixed $items, bool $withBatch = false): array
    {
        if (!is_array($items) || !$items) throw new ApiException('VALIDATION', 'At least one item is required', 422, ['items' => 'Required']);
        $rows = []; $errors = [];
        foreach (array_values($items) as $i => $it) {
            $it = is_array($it) ? $it : [];
            $v = new V($it);
            $variantId = $v->int('variant_id');
            $qty = $v->num('quantity', true, 0.001);
            $rate = $v->num('rate', false, 0);
            $disc = $v->num('discount_percent', false, 0, 100) ?? '0';
            $desc = $v->str('description', false, 0, 400);
            $unit = $v->str('unit_code', false, 0, 20);
            $batch = $withBatch ? $v->str('batch_no', false, 0, 80) : null;
            try { $v->done(); } catch (ApiException $e) { foreach ($e->fields as $k => $m) $errors["items.$i.$k"] = $m; continue; }
            $price = null;
            if ($variantId) {
                $var = Db::one('SELECT v.id, COALESCE(v.name,p.name) AS dname, p.unit_code, COALESCE(v.selling_price,p.selling_price) AS price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=?', [$variantId]);
                if (!$var) { $errors["items.$i.variant_id"] = 'Variant not found'; continue; }
                $desc = $desc ?: $var['dname']; $unit = $unit ?: $var['unit_code']; $price = $var['price'];
            }
            if (!$desc) { $errors["items.$i.description"] = 'Required'; continue; }
            if ($rate === null) $rate = $price;
            if ($rate === null) { $errors["items.$i.rate"] = 'Required'; continue; }
            $row = ['variant_id' => $variantId, 'description' => $desc, 'unit_code' => $unit, 'quantity' => $qty, 'rate' => $rate, 'discount_percent' => $disc, 'sort_order' => $i];
            if ($withBatch) $row['batch_no'] = $batch;
            $rows[] = $row;
        }
        if ($errors) throw new ApiException('VALIDATION', 'Please correct the item rows', 422, $errors);
        return $rows;
    }
}

final class InvoiceService
{
    private static function header(array $d, bool $creating): array
    {
        $v = new V($d);
        $customer = $v->int('customer_id', $creating, 1);
        $date = $v->date('invoice_date') ?? date('Y-m-d');
        $due = $v->date('due_date');
        $buyer = $v->str('buyer_ref', false, 0, 160); $po = $v->str('po_no', false, 0, 80); $style = $v->str('style_no', false, 0, 80);
        $disc = $v->num('discount', false, 0) ?? '0';
        $taxRate = $v->num('tax_rate', false, 0, 100);
        $notes = $v->str('notes', false, 0, 2000);
        $orderId = $v->int('order_id', false, 1);
        $v->done();
        if ($customer && !Db::one('SELECT id FROM customers WHERE id=?', [$customer])) throw new ApiException('VALIDATION', 'Customer not found', 422, ['customer_id' => 'Not found']);
        if ($taxRate === null) {
            $s = Db::one('SELECT tax_enabled, tax_rate FROM company_settings WHERE id=1');
            $taxRate = ($s && (int)$s['tax_enabled']) ? (string)$s['tax_rate'] : '0';
        }
        $h = ['invoice_date' => $date, 'due_date' => $due, 'buyer_ref' => $buyer, 'po_no' => $po, 'style_no' => $style, 'discount' => $disc, 'tax_rate' => $taxRate, 'notes' => $notes];
        if ($customer) $h['customer_id'] = $customer;
        if ($orderId) $h['order_id'] = $orderId;
        return $h;
    }

    public static function recalc(int $id): void
    {
        Db::exec('UPDATE invoices i SET subtotal=(SELECT COALESCE(SUM(amount),0) FROM invoice_items WHERE invoice_id=i.id),
                  tax_amount=ROUND(GREATEST((SELECT COALESCE(SUM(amount),0) FROM invoice_items WHERE invoice_id=i.id)-i.discount,0)*i.tax_rate/100,2) WHERE i.id=?', [$id]);
        Db::exec('UPDATE invoices SET total=GREATEST(subtotal-discount,0)+tax_amount WHERE id=?', [$id]);
    }

    public static function create(array $d): int
    {
        $h = self::header($d, true);
        $items = LineItems::normalize($d['items'] ?? null, true);
        return Db::tx(function () use ($h, $items) {
            $h['invoice_no'] = Numbering::next('invoice');
            $h['status'] = 'draft'; $h['created_by'] = Auth::id();
            $id = Db::insert('invoices', $h);
            foreach ($items as $r) Db::insert('invoice_items', ['invoice_id' => $id] + $r);
            self::recalc($id);
            Audit::log('invoices', 'INSERT', $id, ['invoice_no' => $h['invoice_no']]);
            return $id;
        });
    }

    public static function update(int $id, array $d): void
    {
        $items = LineItems::normalize($d['items'] ?? null, true);
        Db::tx(function () use ($id, $d, $items) {
            $inv = needRow(Db::one('SELECT * FROM invoices WHERE id=? FOR UPDATE', [$id]), 'Invoice');
            if ($inv['status'] !== 'draft') throw new ApiException('NOT_DRAFT', 'Only draft invoices can be edited', 409);
            $h = self::header($d + ['customer_id' => $inv['customer_id']], false);
            if (!array_key_exists('tax_rate', $d)) $h['tax_rate'] = $inv['tax_rate'];
            Db::update('invoices', $id, $h);
            Db::exec('DELETE FROM invoice_items WHERE invoice_id=?', [$id]);
            foreach ($items as $r) Db::insert('invoice_items', ['invoice_id' => $id] + $r);
            self::recalc($id);
            Audit::log('invoices', 'UPDATE', $id);
        });
    }

    public static function deleteDraft(int $id): void
    {
        Db::tx(function () use ($id) {
            $inv = needRow(Db::one('SELECT status FROM invoices WHERE id=? FOR UPDATE', [$id]), 'Invoice');
            if ($inv['status'] !== 'draft') throw new ApiException('NOT_DRAFT', 'Only draft invoices can be deleted', 409);
            Db::exec('DELETE FROM invoices WHERE id=?', [$id]);
            Audit::log('invoices', 'DELETE', $id);
        });
    }

    public static function confirm(int $id): array
    {
        $warnings = [];
        Db::tx(function () use ($id, &$warnings) {
            $inv = needRow(Db::one('SELECT * FROM invoices WHERE id=? FOR UPDATE', [$id]), 'Invoice');
            if ($inv['status'] !== 'draft') throw new ApiException('NOT_DRAFT', 'Only draft invoices can be confirmed', 409);
            $items = Db::all('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id', [$id]);
            if (!$items) throw new ApiException('VALIDATION', 'Invoice has no items', 422);
            $need = []; $desc = [];
            foreach ($items as $it) if ($it['variant_id']) { $k = (int)$it['variant_id']; $need[$k] = ($need[$k] ?? 0) + (float)$it['quantity']; $desc[$k] ??= $it['description']; }
            ksort($need);
            foreach ($need as $vid => $q) {
                StockService::lock($vid);
                $on = StockService::onHand($vid);
                if (Money::cmp3($on, $q) < 0)
                    throw new ApiException('STOCK_SHORT', sprintf('Insufficient stock for "%s": available %s, needed %s', $desc[$vid], rtrim(rtrim($on, '0'), '.') ?: '0', rtrim(rtrim(number_format($q, 3, '.', ''), '0'), '.')), 409);
            }
            foreach ($items as $it) if ($it['variant_id'])
                StockService::post((int)$it['variant_id'], 'sale_out', '-' . $it['quantity'], 'invoice', $id, 'Invoice ' . $inv['invoice_no'], $inv['buyer_ref'], $inv['style_no'], $it['batch_no']);
            $cust = Db::one('SELECT credit_days FROM customers WHERE id=?', [$inv['customer_id']]);
            $due = $inv['due_date'] ?: date('Y-m-d', strtotime($inv['invoice_date'] . ' +' . (int)($cust['credit_days'] ?? 0) . ' days'));
            Db::update('invoices', $id, ['status' => 'due', 'due_date' => $due]);
            PaymentService::sync($id);
            if ($inv['order_id']) Db::exec("UPDATE sales_orders SET status='invoiced' WHERE id=?", [$inv['order_id']]);
            $b = Db::one('SELECT due_balance, credit_limit FROM v_customer_balance WHERE customer_id=?', [$inv['customer_id']]);
            if ($b && (float)$b['credit_limit'] > 0 && (float)$b['due_balance'] > (float)$b['credit_limit'])
                $warnings[] = 'Customer credit limit exceeded: due balance ' . $b['due_balance'] . ' > limit ' . $b['credit_limit'];
            Audit::log('invoices', 'CONFIRM', $id);
        });
        return ['invoice' => self::get($id), 'warnings' => $warnings];
    }

    public static function cancel(int $id, string $reason): void
    {
        Db::tx(function () use ($id, $reason) {
            $inv = needRow(Db::one('SELECT * FROM invoices WHERE id=? FOR UPDATE', [$id]), 'Invoice');
            if ($inv['status'] === 'cancelled') throw new ApiException('ALREADY_CANCELLED', 'Invoice is already cancelled', 409);
            if ((int)Db::val('SELECT COUNT(*) FROM payments WHERE invoice_id=?', [$id]) > 0)
                throw new ApiException('HAS_PAYMENTS', 'Invoice has payments. Remove or reassign them first', 409);
            if ($inv['status'] !== 'draft') {
                $items = Db::all('SELECT * FROM invoice_items WHERE invoice_id=? AND variant_id IS NOT NULL ORDER BY variant_id', [$id]);
                foreach ($items as $it) {
                    StockService::lock((int)$it['variant_id']);
                    StockService::post((int)$it['variant_id'], 'cancel_reverse', $it['quantity'], 'invoice', $id, 'Cancelled ' . $inv['invoice_no'], $inv['buyer_ref'], $inv['style_no'], $it['batch_no']);
                }
                if ($inv['order_id']) Db::exec("UPDATE sales_orders SET status='confirmed' WHERE id=? AND status='invoiced'", [$inv['order_id']]);
            }
            Db::update('invoices', $id, ['status' => 'cancelled', 'notes' => trim(($inv['notes'] ?? '') . "\nCancelled: " . $reason)]);
            Audit::log('invoices', 'CANCEL', $id, ['reason' => $reason]);
        });
    }

    public static function itemReturn(int $itemId, string $qty, ?string $note): array
    {
        return Db::tx(function () use ($itemId, $qty, $note) {
            $it = needRow(Db::one('SELECT * FROM invoice_items WHERE id=?', [$itemId]), 'Invoice item');
            $inv = needRow(Db::one('SELECT * FROM invoices WHERE id=? FOR UPDATE', [$it['invoice_id']]), 'Invoice');
            if (!in_array($inv['status'], ['due', 'partial', 'paid'], true)) throw new ApiException('NOT_CONFIRMED', 'Returns are only possible on confirmed invoices', 409);
            if (!$it['variant_id']) throw new ApiException('VALIDATION', 'This line has no stock item to return', 422);
            if (Money::cmp3($qty, 0) <= 0) throw new ApiException('VALIDATION', 'Quantity must be greater than zero', 422, ['quantity' => 'Must be > 0']);
            StockService::lock((int)$it['variant_id']);
            $done = (string)Db::val("SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE movement_type='sale_return_in' AND reference_type='invoice_return' AND reference_id=?", [$itemId]);
            if (Money::cmp3((float)$done + (float)$qty, $it['quantity']) > 0)
                throw new ApiException('RETURN_TOO_MUCH', 'Return exceeds sold quantity (already returned: ' . $done . ' of ' . $it['quantity'] . ')', 409);
            StockService::post((int)$it['variant_id'], 'sale_return_in', $qty, 'invoice_return', $itemId, $note ?: 'Return on ' . $inv['invoice_no'], $inv['buyer_ref'], $inv['style_no'], $it['batch_no']);
            $amount = Db::val('SELECT ROUND(? * ? * (1 - ? / 100), 2)', [$qty, $it['rate'], $it['discount_percent']]);
            $pid = Db::insert('payments', [
                'receipt_no' => Numbering::next('receipt'), 'customer_id' => $inv['customer_id'], 'invoice_id' => $inv['id'],
                'payment_date' => date('Y-m-d'), 'method' => 'credit_note', 'reference_no' => 'RET-' . $itemId, 'amount' => $amount,
                'note' => 'Sales return ' . $qty . ' x ' . $it['description'], 'created_by' => Auth::id(),
            ]);
            PaymentService::sync((int)$inv['id']);
            Audit::log('invoices', 'RETURN', $inv['id'], ['item' => $itemId, 'quantity' => $qty, 'credit' => $amount]);
            return ['payment_id' => $pid, 'credit_amount' => Money::fmt($amount)];
        });
    }

    public static function get(int $id): array
    {
        $inv = needRow(Db::one('SELECT i.*, c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=?', [$id]), 'Invoice');
        $out = Shape::invoiceRow($inv);
        $out['items'] = array_map([Shape::class, 'line'], Db::all("SELECT it.*, COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.movement_type='sale_return_in' AND m.reference_type='invoice_return' AND m.reference_id=it.id),0) AS returned_qty
            FROM invoice_items it WHERE it.invoice_id=? ORDER BY it.sort_order, it.id", [$id]));
        $out['payments'] = array_map([Shape::class, 'payment'], Db::all(Shape::PAYMENT_SELECT . ' WHERE p.invoice_id=? ORDER BY p.payment_date, p.id', [$id]));
        $out['challans'] = array_map([Shape::class, 'challan'], Db::all('SELECT * FROM delivery_challans WHERE invoice_id=? ORDER BY id', [$id]));
        $out['customer'] = Shape::customerById((int)$inv['customer_id']);
        $out['company'] = Shape::company();
        return $out;
    }
}
