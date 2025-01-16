import express from "express";
import bodyParser from "body-parser";
import { swapTokens } from "./swap.js";

const app = express();
app.use(bodyParser.json());

app.post("/swapTokens", async (req, res) => {
  console.log(req.body);
  const { from, to, amount } = req.body;
  console.log(from, to, amount);
  try {
    await swapTokens(from, to, amount);
    res.status(200).send("Tokens swapped successfully");
  } catch (error) {
    console.error("Error swapping tokens:", error);
    res.status(500).send("Error swapping tokens");
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
