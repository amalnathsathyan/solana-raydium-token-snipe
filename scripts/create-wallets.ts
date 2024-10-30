import { Keypair, Connection } from "@solana/web3.js";
import * as fs from "fs";
import path from "path";
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config();

const endpoint = process.env.SOLANA_DEVNET_URL as string;
const solanaConnection = new Connection(endpoint, "confirmed");

/**
 * Creates wallets and saves them in the specified folder.
 * @param {number} num - Number of wallets to create.
 * @param {"primary" | "secondary"} type - Type of wallets (primary or secondary).
 */
export function createWallets(num: number, type: "primary" | "secondary") {
  // Determine the folder based on wallet type
  const folderName = type === "primary" ? "PrimaryWallets" : "SecondaryWallets";
  const folderPath = path.join(__dirname, folderName);

  // Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
    console.log(`Created folder: ${folderName}`);
  }

  for (let i = 0; i < num; i++) {
    const keypair = Keypair.generate();
    const privateKey = bs58.encode(keypair.secretKey);
    const publicKey = keypair.publicKey.toString();
    console.log(`Generated wallet #${i + 1}: ${publicKey}`);

    // Name the wallet file as wallet_<index>.json
    const filePath = path.join(folderPath, `wallet_${i + 1}.json`);
    const secretArray = Array.from(keypair.secretKey);
    const secret = JSON.stringify(secretArray);

    // Write the wallet file
    fs.writeFileSync(filePath, secret, "utf8");
    console.log(`Saved wallet to ${filePath}`);
  }

  console.log(`${num} wallets created and saved in ${folderName} folder.`);
}

// Uncomment the following line to create primary wallets (for testing purposes)
// createWallets(20, "primary");

// Uncomment the following line to create secondary wallets (for testing purposes)
// createWallets(10, "secondary");
