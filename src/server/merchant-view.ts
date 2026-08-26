// The customer-facing shape of a merchant row.
//
// Product law §4.6: an unverified cancel URL never renders to a customer.
// Sending someone to a guessed cancellation page is worse than sending them
// nowhere — they follow a dead link, believe they cancelled, and keep being
// charged. So the link exists for a customer only once an admin has recorded
// where it came from (§4.7's source note).
//
// Every customer-facing router passes merchant rows through here rather than
// re-checking the flag, so there is one place to get this right — and one
// place for `tests/merchant-view.test.ts` to hold.

type MerchantLike = {
  cancelUrl: string | null;
  cancelUrlVerifiedAt: Date | null;
  cancelUrlVerifiedBy: string | null;
  cancelUrlSource: string | null;
};

export type CustomerMerchant<T extends MerchantLike> = Omit<
  T,
  "cancelUrlVerifiedBy" | "cancelUrlSource"
> & {
  /** Present only when verified. */
  cancelUrl: string | null;
  /** So the UI can say "we haven't verified a link for this one yet". */
  cancelUrlVerified: boolean;
};

export function customerMerchant<T extends MerchantLike>(merchant: T): CustomerMerchant<T>;
export function customerMerchant<T extends MerchantLike>(merchant: null): null;
export function customerMerchant<T extends MerchantLike>(
  merchant: T | null,
): CustomerMerchant<T> | null;
export function customerMerchant<T extends MerchantLike>(
  merchant: T | null,
): CustomerMerchant<T> | null {
  if (!merchant) return null;
  const verified = merchant.cancelUrlVerifiedAt !== null;
  // The verification metadata is admin data (who checked it, against what):
  // it is stripped rather than merely ignored, so it cannot leak through a
  // spread into a client payload.
  const {
    cancelUrlVerifiedBy: _by,
    cancelUrlSource: _source,
    ...rest
  } = merchant;
  return {
    ...rest,
    cancelUrl: verified ? merchant.cancelUrl : null,
    cancelUrlVerified: verified,
  } as CustomerMerchant<T>;
}
