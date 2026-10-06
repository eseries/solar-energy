-- Prevent a payment ledger effect from being recorded more than once.
CREATE UNIQUE INDEX "LedgerEntry_type_reference_key"
ON "LedgerEntry"("type", "reference");
