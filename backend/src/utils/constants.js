/** Domain vocabulary shared by services, validators and the seed script. */

export const ITEM_TYPES = ['lost', 'found'];

/** Item status lifecycle - spec section 8. */
export const ITEM_STATUS = {
  REPORTED: 'REPORTED',
  POSSIBLE_MATCH: 'POSSIBLE_MATCH',
  CLAIM_REQUESTED: 'CLAIM_REQUESTED',
  VERIFICATION: 'VERIFICATION',
  RETURNED: 'RETURNED',
  CLOSED: 'CLOSED',
};

export const ITEM_STATUS_ORDER = [
  ITEM_STATUS.REPORTED,
  ITEM_STATUS.POSSIBLE_MATCH,
  ITEM_STATUS.CLAIM_REQUESTED,
  ITEM_STATUS.VERIFICATION,
  ITEM_STATUS.RETURNED,
  ITEM_STATUS.CLOSED,
];

/** An item that reached one of these is out of the matching pool. */
export const ITEM_TERMINAL_STATUS = [ITEM_STATUS.RETURNED, ITEM_STATUS.CLOSED];

export const MATCH_STATUS = {
  POSSIBLE: 'POSSIBLE',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
};

export const CLAIM_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  HANDOVER_CONFIRMED: 'HANDOVER_CONFIRMED',
};

export const NOTIFICATION_TYPES = {
  MATCH_FOUND: 'MATCH_FOUND',
  CLAIM_SUBMITTED: 'CLAIM_SUBMITTED',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  HANDOVER_CONFIRMED: 'HANDOVER_CONFIRMED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  ITEM_MODERATED: 'ITEM_MODERATED',
};

export const ROLES = { USER: 'user', ADMIN: 'admin' };

export const CATEGORIES = [
  'Wallet / Purse',
  'Mobile Phone',
  'Laptop / Tablet',
  'ID Card / Documents',
  'Keys',
  'Bag / Backpack',
  'Books / Stationery',
  'Clothing',
  'Jewellery / Watch',
  'Earphones / Accessories',
  'Water Bottle',
  'Sports Equipment',
  'Other',
];

/** ISO-8601 timestamp used for every created_at / updated_at value. */
export const now = () => new Date().toISOString();
