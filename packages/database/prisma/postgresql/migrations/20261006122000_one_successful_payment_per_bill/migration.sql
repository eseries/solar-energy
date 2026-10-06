-- A bill may have many payment attempts, but at most one may be successful.
-- Pending, failed, and reversed attempts remain valid.
CREATE UNIQUE INDEX "Payment_one_successful_per_bill_key"
ON "Payment" ("billId")
WHERE "billId" IS NOT NULL AND "status" = 'SUCCESS';
