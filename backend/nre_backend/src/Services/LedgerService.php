<?php
declare(strict_types=1);

final class LedgerService
{
    /** Rows: [d, t, n, debit, credit]; $sign +1: balance grows with debit (customer); -1: grows with credit (supplier payable). */
    private static function build(float $opening, string $openDate, array $rows, ?string $from, ?string $to, int $sign): array
    {
        $bal = $opening; $list = [];
        foreach ($rows as $r) {
            $delta = $sign * ((float)$r['debit'] - (float)$r['credit']);
            if ($from && $r['d'] < $from) { $bal += $delta; continue; }
            if ($to && $r['d'] > $to) continue;
            $list[] = [$r, $delta];
        }
        $start = $bal;
        $pos = max($start, 0.0); $neg = max(-$start, 0.0);
        $out = [['date' => $from ?: $openDate, 'type' => 'opening', 'doc_no' => null,
            'debit' => Money::fmt($sign > 0 ? $pos : $neg), 'credit' => Money::fmt($sign > 0 ? $neg : $pos), 'running_balance' => Money::fmt($start)]];
        foreach ($list as [$r, $delta]) {
            $bal += $delta;
            $out[] = ['date' => $r['d'], 'type' => $r['t'], 'doc_no' => $r['n'], 'debit' => Money::fmt($r['debit']), 'credit' => Money::fmt($r['credit']), 'running_balance' => Money::fmt($bal)];
        }
        return $out;
    }
    public static function customer(int $id, ?string $from, ?string $to): array
    {
        $c = needRow(Db::one('SELECT id, opening_balance, DATE(created_at) AS d0 FROM customers WHERE id=?', [$id]), 'Customer');
        $rows = Db::all("SELECT d, t, n, debit, credit FROM (
              SELECT invoice_date AS d, 'invoice' AS t, invoice_no AS n, total AS debit, 0 AS credit, id, 0 AS ord FROM invoices WHERE customer_id=? AND status IN ('due','partial','paid')
              UNION ALL
              SELECT payment_date, 'payment', receipt_no, 0, amount, id, 1 FROM payments WHERE customer_id=?
            ) e ORDER BY d, ord, id", [$id, $id]);
        return self::build((float)$c['opening_balance'], (string)$c['d0'], $rows, $from, $to, 1);
    }
    public static function supplier(int $id, ?string $from, ?string $to): array
    {
        $s = needRow(Db::one('SELECT id, opening_balance, DATE(created_at) AS d0 FROM suppliers WHERE id=?', [$id]), 'Supplier');
        $rows = Db::all("SELECT d, t, n, debit, credit FROM (
              SELECT po.order_date AS d, 'purchase' AS t, po.po_no AS n, 0 AS debit, SUM(i.received_value) AS credit, po.id AS id, 0 AS ord
                FROM purchase_orders po JOIN purchase_order_items i ON i.po_id=po.id WHERE po.supplier_id=? AND po.status<>'cancelled' GROUP BY po.id, po.order_date, po.po_no HAVING SUM(i.received_value) > 0
              UNION ALL
              SELECT payment_date, 'supplier_payment', voucher_no, amount, 0, id, 1 FROM supplier_payments WHERE supplier_id=?
            ) e ORDER BY d, ord, id", [$id, $id]);
        return self::build((float)$s['opening_balance'], (string)$s['d0'], $rows, $from, $to, -1);
    }
}
