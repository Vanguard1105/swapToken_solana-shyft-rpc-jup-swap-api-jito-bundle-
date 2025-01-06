import { Router } from "express";
import { addOrder, removeOrder, getOrders } from "../controllers/orderControllers";
const router = Router();

router.post("/getOrders", getOrders);
router.post("/addOrder", addOrder);
router.post("/removeOrder", removeOrder);

export default router;
