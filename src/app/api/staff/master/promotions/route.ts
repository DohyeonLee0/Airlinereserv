import { deactivatePromotion, listPromotions, upsertPromotion } from "@/controllers/masterDataController";

export const GET = listPromotions;
export { upsertPromotion as POST };
export { deactivatePromotion as DELETE };
