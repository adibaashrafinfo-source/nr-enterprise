<?php
declare(strict_types=1);

final class StockService
{
    public static function lock(int $variantId): void
    {
        if (Db::one('SELECT id FROM product_variants WHERE id=? FOR UPDATE', [$variantId]) === null)
            throw new ApiException('NOT_FOUND', 'Variant not found', 404);
    }
    public static function onHand(int $variantId): string
    {
        return (string)Db::val('SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE variant_id=?', [$variantId]);
    }
    /** ONLY writer of stock_movements. Call inside a transaction after lock(). */
    public static function post(int $variantId, string $type, string|float $signedQty, ?string $refType, ?int $refId, ?string $note = null, ?string $buyer = null, ?string $style = null, ?string $batch = null): int
    {
        if (Money::cmp3($signedQty, 0) === 0) throw new ApiException('VALIDATION', 'Quantity cannot be zero', 422);
        return Db::insert('stock_movements', [
            'variant_id' => $variantId, 'movement_type' => $type, 'quantity' => (string)$signedQty,
            'reference_type' => $refType, 'reference_id' => $refId, 'note' => $note,
            'buyer_ref' => $buyer, 'style_no' => $style, 'batch_no' => $batch, 'created_by' => Auth::id(),
        ]);
    }
    public static function opening(int $variantId, string $qty, ?string $cost, ?string $note): array
    {
        return Db::tx(function () use ($variantId, $qty, $cost, $note) {
            self::lock($variantId);
            $mid = self::post($variantId, 'opening', $qty, 'opening', null, $note ?: 'Opening stock');
            if ($cost !== null) Db::exec('INSERT INTO variant_costs (variant_id, purchase_price) VALUES (?,?) ON DUPLICATE KEY UPDATE purchase_price=VALUES(purchase_price)', [$variantId, $cost]);
            Audit::log('stock_movements', 'OPENING', $variantId, ['quantity' => $qty, 'cost' => $cost]);
            return ['variant_id' => $variantId, 'qty_on_hand' => self::onHand($variantId), 'movement_id' => $mid];
        });
    }
    public static function adjust(int $variantId, string $qty, string $reason): array
    {
        return Db::tx(function () use ($variantId, $qty, $reason) {
            self::lock($variantId);
            $on = self::onHand($variantId);
            if (Money::cmp3($qty, 0) < 0 && Money::cmp3((float)$on + (float)$qty, 0) < 0)
                throw new ApiException('NEGATIVE_STOCK', 'Adjustment would make stock negative (on hand: ' . $on . ')', 409);
            $mid = self::post($variantId, Money::cmp3($qty, 0) > 0 ? 'adjustment_in' : 'adjustment_out', $qty, 'adjustment', null, $reason);
            Audit::log('stock_movements', 'ADJUST', $variantId, ['quantity' => $qty, 'reason' => $reason]);
            return ['variant_id' => $variantId, 'qty_on_hand' => self::onHand($variantId), 'movement_id' => $mid];
        });
    }
}
