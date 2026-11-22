// =====================================================================
//  SITE CONFIGURATION - edit this file after deploying in Remix
// =====================================================================
//  1. Deploy each contract in Remix on the Sepolia test network
//     (Environment: "Injected Provider - MetaMask").
//  2. Copy each deployed contract address into `contracts` below.
//  3. Optional: copy the block number of each deployment (from Etherscan)
//     into `deployBlock`, so the activity feeds load faster.
// =====================================================================

window.CONFIG = {
  network: {
    name: "Sepolia",
    chainId: 11155111,
    chainIdHex: "0xaa36a7",
    explorer: "https://sepolia.etherscan.io"
  },

  contracts: {
    StrikeCoin: "0x1B4f4E3325f8d762CFa83271c11b3b35b6e288aC", // Client 1 - ERC-20 (STRK) v2 with exchange (old v1: 0x66Da944e57d4ff0D8f146c30eCBA37108dA5c544)
    ElitePass: "0x335a8b9e0b0DeEA66C286Ec9b2bff6a4cBEf7395", // Client 1 - ERC-721 (EPASS)
    ApexPoints: "0x8959bD1d8620FbfaE2E5816C8B7CcD3752d3b5ED", // Client 2 - ERC-20  (APXP)
    ApexGear: "0x197441806cc2933698470697BF13394955582A5b", // Client 2 - ERC-721 (APEXG)
    GarageChallenge: "0x05961b74aa4433051e6E6a07320ff047cd7d4CF6"  // Client 2 - workshop game rewards (fund it with APXP)
  },

  deployBlock: {
    StrikeCoin: 0,
    ElitePass:  0,
    ApexPoints: 0,
    ApexGear:   0,
    GarageChallenge: 0
  },

  // Folder holding the NFT images (used when the site builds token metadata automatically).
  assetPath: "",

  // Business rules used by the website (kept off-chain so staff can change them).
  turf: {
    pitches: ["Pitch A - 5-a-side football", "Pitch B - Cricket nets", "Pitch C - Full-size rugby"],
    priceHourly: 40,   // STRK per hour
    priceFullDay: 250, // STRK per day
    heroVideo: ""      // optional: e.g. "turf-hero.mp4" (a royalty-free clip you upload next to the pages)
  },
  apex: {
    pointsPerEuro: 1,     // points rewarded per EUR 1 spent on a service
    euroPer100Points: 5,  // value of 100 points when redeemed
    heroVideo: ""         // optional: e.g. "apex-hero.mp4"
  }
};
