import { Router } from "express";
import { getUsers } from "../controllers/userController";

const router = Router();

router.post("/users", getUsers);

export default router;
