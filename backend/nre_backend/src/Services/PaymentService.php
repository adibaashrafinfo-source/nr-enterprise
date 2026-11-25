<?php
declare(strict_types=1);

final class PaymentService
{
    public const METHODS = ['cash', 'bkash', 'nagad', 'bank', 'cheque', 'other'];

    public static function sync(int $invoiceId): void
    {
        Db::exec("UPDATE invoices i SET
            paid_amount=(SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id=i.id),
            status=CASE WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id=i.id) >= i.total AND i.total > 0 THEN 'paid'
                        WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id=i.id) > 0 THEN 'partial'
                        ELSE 'due' END
            WHERE i.id=? AND i.status IN ('due','partial','paid')", [$invoiceId]);
    }

    private static function fields(array $d): array
    {
        $v = new V($d);
        $date = $v->date('payment_date') ?? date('Y-m-d');
        $method = $v->enum('method', self::METHODS, false, 'cash');
        $ref = $v->str('reference_no', false, 0, 80);
        $amount = $v->num('amount', true, 0.01);
        $note = $v->str('note', false, 0, 500);
        $v->done();
        return ['payment_date' => $date, 'method' => $method, 'reference_no' => $ref, 'amount' => $amount, 'note' => $note];
    }

    public static function add(int $invoiceId, array $d): int
    {
        $f = self::fields($d);
        return Db::tx(function () use ($invoiceId, $f) {
            $inv = needRow(Db::one('SELECT * FROM invoices WHERE id=? FOR UPDATE', [$invoiceId]), 'Invoice');
            if (!in_array($inv['status'], ['due', 'partial'], true)) throw new ApiException('NOT_PAYABLE', $inv['status'] === 'paid' ? 'Invoice is already fully paid' : 'Payments are only possible on confirmed, unpaid invoices', 409);
            $bal = (string)Db::val('SELECT total - paid_amount FROM invoices WHERE id=?', [$invoiceId]);
            if (Money::cmp3($f['amount'], $bal) > 0) throw new ApiException('OVERPAYMENT', 'Amount exceeds balance due (' . Money::fmt($bal) . ')', 409, ['amount' => 'Max ' . Money::fmt($bal)]);
            $id = Db::insert('payments', $f + ['receipt_no' => Numbering::next('receipt'), 'customer_id' => $inv['customer_id'], 'invoice_id' => $invoiceId, 'created_by' => Auth::id()]);
            self::sync($invoiceId);
            Audit::log('payments', 'INSERT', $id, ['invoice' => $invoiceId, 'amount' => $f['amount']]);
            return $id;
        });
    }

    public static function update(int $id, array $d): void
    {
        $f = self::fields($d);
        Db::tx(function () use ($id, $f) {
            $p = needRow(Db::one('SELECT * FROM payments WHERE id=? FOR UPDATE', [$id]), 'Payment');
            if ($p['method'] === 'credit_note') throw new ApiException('LOCKED', 'Credit notes cannot be edited', 409);
            if ($p['invoice_id']) {
                $inv = Db::one('SELECT total, paid_amount, status FROM invoices WHERE id=? FOR UPDATE', [$p['invoice_id']]);
                $max = (float)$inv['total'] - ((float)$inv['paid_amount'] - (float)$p['amount']);
                if (Money::cmp3($f['amount'], $max) > 0) throw new ApiException('OVERPAYMENT', 'Amount exceeds invoice total', 409);
            }
            Db::update('payments', $id, $f);
            if ($p['invoice_id']) self::sync((int)$p['invoice_id']);
            Audit::log('payments', 'UPDATE', $id);
        });
    }

    public static function delete(int $id): void
    {
        Db::tx(function () use ($id) {
            $p = needRow(Db::one('SELECT * FROM payments WHERE id=? FOR UPDATE', [$id]), 'Payment');
            if ($p['method'] === 'credit_note') throw new ApiException('LOCKED', 'Credit notes cannot be deleted', 409);
            Db::exec('DELETE FROM payments WHERE id=?', [$id]);
            if ($p['invoice_id']) self::sync((int)$p['invoice_id']);
            Audit::log('payments', 'DELETE', $id, ['amount' => $p['amount']]);
        });
    }
}
