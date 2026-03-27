import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying BlitzSavings...");
  console.log("  Deployer :", deployer.address);
  console.log("  Network  :", (await ethers.provider.getNetwork()).name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance  :", ethers.formatEther(balance), "tRBTC");

  if (balance === 0n) {
    console.error(
      "\n✗ Deployer has no tRBTC. Get testnet funds at https://faucet.rootstock.io\n"
    );
    process.exit(1);
  }

  const BlitzSavings = await ethers.getContractFactory("BlitzSavings");
  const contract = await BlitzSavings.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ BlitzSavings deployed to:", address);
  console.log(
    "   Explorer: https://explorer.testnet.rootstock.io/address/" + address
  );

  // Write address to .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (envContent.includes("NEXT_PUBLIC_BLITZ_SAVINGS_ADDRESS=")) {
    envContent = envContent.replace(
      /NEXT_PUBLIC_BLITZ_SAVINGS_ADDRESS=.*/,
      `NEXT_PUBLIC_BLITZ_SAVINGS_ADDRESS=${address}`
    );
  } else {
    envContent += `\nNEXT_PUBLIC_BLITZ_SAVINGS_ADDRESS=${address}`;
  }

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("   .env.local updated with contract address.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
