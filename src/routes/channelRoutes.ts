import { Router } from "express";
import { addChannel, startClient, getChannels, updateChannel} from "../controllers/channelController";
const router = Router();

router.post("/addChannel", addChannel);
router.post("/startClient", startClient);
router.post("/getChannels", getChannels);
router.post("/updateChannel", updateChannel);

export default router;
