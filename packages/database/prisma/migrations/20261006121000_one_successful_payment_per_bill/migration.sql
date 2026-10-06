-- A bill may have many payment attempts, but at most one may be successful.
-- This is intentionally partial so pending/failed/reversed attempts remain valid.
CREATE UNIQUE INDEX "Payment_one_successful_per_bill_key"
ON "Payment"("billId")
WHERE "billId" IS NOT NULL AND "status" = 'SUCCESS';
