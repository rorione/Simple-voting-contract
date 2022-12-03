import { ethers } from "hardhat";
import { expect } from "chai";
import { SaltToken__factory } from '../types/factories/contracts/SALT.sol/SaltToken__factory';

describe("Salt Token", function () {
    async function deployToken() {
        const [owner] = await ethers.getSigners();
        const Salt = await ethers.getContractFactory("SaltToken") as SaltToken__factory;

        const salt = await Salt.deploy();

        return { salt, owner };
    }

    describe("Transfers", function () {
        it("Transfer between addresses shoud succeed", async function () {
            const { salt, owner } = await deployToken();

            const user1 = (await ethers.getSigners())[1];

            await salt.connect(owner).transfer(user1.address, 100);

            const [_, event] = await salt.queryFilter(salt.filters.Transfer(null, null, null));

            expect(event.args.to).to.equal(user1.address);
            expect(event.args.value).to.equal(100);
        });

        it("Transfer between addresses shoud fail", async function () {
            const { salt, owner } = await deployToken();

            const bob = (await ethers.getSigners())[1];

            const transfer = salt.connect(bob).transfer(owner.address, 1)
            await expect(transfer).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });
    });

    describe("Init", function () {

        it("Token has correct name", async function () {
            const { salt } = await deployToken();

            expect(await salt.name()).to.equal("SaltToken");
        });

        it("Token has correct totalSupply", async function () {
            const { salt } = await deployToken();

            expect(await salt.totalSupply()).to.equal(100_000_000);
        });

        it("Token has correct decimals", async function () {
            const { salt } = await deployToken();

            expect(await salt.decimals()).to.equal(6);
        });

        it("Token has correct symbol", async function () {
            const { salt } = await deployToken();

            expect(await salt.symbol()).to.equal("SLT");
        });

    });

    
});