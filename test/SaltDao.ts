import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SaltToken__factory } from '../types/factories/contracts/SaltToken__factory';
import { SaltDao__factory } from '../types/factories/contracts/SaltDao__factory';

describe("SaltDao", function () {
    
    async function deployDao3UsersWithBalances() {
        const [user1, user2, user3, user4] = await ethers.getSigners();

        const Salt = await ethers.getContractFactory("SaltToken") as SaltToken__factory;
        const salt = await Salt.deploy();

        const SaltDAO = await ethers.getContractFactory("SaltDao") as SaltDao__factory;
        const saltDAO = await SaltDAO.deploy(salt.address);

        await salt.connect(user1).transfer(user2.address, 40 * 10 ** 6);
        await salt.connect(user1).transfer(user3.address, 35 * 10 ** 6);

        await salt.connect(user1).delegate(user1.address);
        await salt.connect(user2).delegate(user2.address);
        await salt.connect(user3).delegate(user3.address);

        return { salt, saltDAO, user1, user2, user3, user4 };
    }

    describe("Deployment", function () {
        it("Should be right balances", async function () {
            const { salt, user1, user2, user3 } = await loadFixture(deployDao3UsersWithBalances);

            expect(await salt.balanceOf(user1.address)).to.equal(25 * 10 ** 6);
            expect(await salt.balanceOf(user2.address)).to.equal(40 * 10 ** 6);
            expect(await salt.balanceOf(user3.address)).to.equal(35 * 10 ** 6);
        });

        it("Should be right totalSupply", async function () {
            const { salt } = await loadFixture(deployDao3UsersWithBalances);

            expect(await salt.totalSupply()).to.equal(100 * 10 ** 6);
        });

        it("Proposals list should contain only expired proposals", async function () {
            const { saltDAO } = await loadFixture(deployDao3UsersWithBalances);

            const blockNumber = ethers.provider.blockNumber;
            const block = await ethers.provider.getBlock(blockNumber);

            const proposals = (await saltDAO.getProposals()).filter((prop) => {
                prop.ttl.gt(block.timestamp)
            })

            expect(proposals.length).to.equal(0);
        })
    })

    describe("Create proposal", function () {
        it("Should create new proposal corrctly", async function () {
            const { saltDAO, user1 } = await loadFixture(deployDao3UsersWithBalances);

            const proposalId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(proposalId);
            console.log("New proposal created");

            const blockNumber = await time.latestBlock();
            const timestamp = await time.latest();

            const [event] = await saltDAO.queryFilter(saltDAO.filters.ProposalCreated(null, null, null, null));
            expect(event.args.proposalId).to.equal(proposalId);
            expect(event.args.expiration).to.equal(timestamp + 3 * 24 * 60 * 60);
            console.log("Event 'ProposalCreated' values are as expected")

            const activeProposals = (await saltDAO.getProposals()).filter((prop) => prop.ttl.gt(timestamp))
            expect(activeProposals.length).to.equal(1);
            
            const proposal = activeProposals[0];
            expect(proposal.agreements).to.equal(0);
            expect(proposal.disagreements).to.equal(0);
            expect(proposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(proposal.createdAtBlock).to.equal(blockNumber);
            console.log("New proposal arrived in 'getProposals()' and has correct values")

            const sameProposal = await saltDAO.getProposal(proposalId)
            expect(sameProposal.agreements).to.equal(0);
            expect(sameProposal.disagreements).to.equal(0);
            expect(sameProposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(sameProposal.createdAtBlock).to.equal(blockNumber);
            console.log("New proposal arrived in 'getProposal(id)' and has correct values'")
        });

        it("Creating already exising proposal should return error", async function () {
            const { saltDAO, user1 } = await loadFixture(deployDao3UsersWithBalances);
            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await saltDAO.connect(user1).addNewProposal(prop);
            await expect(saltDAO.connect(user1).addNewProposal(prop)).to.be.revertedWith("Proposal already exists");
            console.log("New proposal creation reverted because such proposal already exists");
        });

        it("Creating proposal by address without tokens should return error", async function () {
            const { saltDAO, user4 } = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await expect(saltDAO.connect(user4).addNewProposal(prop)).to.be.revertedWith("Not enough balance");
            console.log("New proposal creation reverted because address had no tokens at all");
        });

        it("Creating proposal when all proposal slots are occupied should return error", async function () {
            const { saltDAO, user1 } = await loadFixture(deployDao3UsersWithBalances);
            const proposalLimit = await saltDAO.PROPOSALS_MAX_COUNT();

            for (let i = 0; i < proposalLimit; i++) {
                const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${i}`));
                await saltDAO.connect(user1).addNewProposal(prop);
            }
            console.log("Added %d proposals", proposalLimit)

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Last proposal"));
            const newProposal = saltDAO.connect(user1).addNewProposal(prop);
            await expect(newProposal).to.be.revertedWith("All proposal slots are occupied");
            console.log("New proposal creation reverted because all proposal slots are occupied");
        });

        it("Should create new proposal corrctly if one of them is expired", async function () {
            const { saltDAO, user1 } = await loadFixture(deployDao3UsersWithBalances);

            const proposalLimit = await saltDAO.PROPOSALS_MAX_COUNT();

            for (let i = 0; i < proposalLimit; i++) {
                const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${i}`));
                await saltDAO.connect(user1).addNewProposal(prop);
                console.log("Proposal %d created", i);
                await time.increase(24 * 60 * 60);
                console.log("Skipped 1 day");
            }

            const propId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Last proposal"));
            await saltDAO.connect(user1).addNewProposal(propId);
            console.log("New proposal created");

            const blockNumber = await time.latestBlock();
            const timestamp = await time.latest();

            const [event] = await saltDAO.queryFilter(saltDAO.filters.ProposalCreated(propId, null, null, null));
            expect(event.args.proposalId).to.equal(propId);
            expect(event.args.expiration).to.equal(timestamp + 3 * 24 * 60 * 60);
            console.log("Values of event 'ProposalCreated' are correct");

            const activeProposals = (await saltDAO.getProposals())
            expect(activeProposals.length).to.equal(proposalLimit);
            
            const proposal = activeProposals.find(prop => prop.id === propId)!;
            expect(proposal.agreements).to.equal(0);
            expect(proposal.disagreements).to.equal(0);
            expect(proposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(proposal.createdAtBlock).to.equal(blockNumber);
            console.log("Values of proposal from 'getProposals()' are correct");
            
            const sameProposal = await saltDAO.getProposal(propId)
            expect(sameProposal.agreements).to.equal(0);
            expect(sameProposal.disagreements).to.equal(0);
            expect(sameProposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(sameProposal.createdAtBlock).to.equal(blockNumber);
            console.log("Values of proposal from 'getProposal(id)' are correct");
        });

        it("Should create new proposal corrctly if one of them is accepted", async function () {
            const { saltDAO, user1, user2 } = await loadFixture(deployDao3UsersWithBalances);

            const proposalLimit = await saltDAO.PROPOSALS_MAX_COUNT();

            for (let i = 0; i < proposalLimit; i++) {
                const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${i}`));
                await saltDAO.connect(user1).addNewProposal(prop);
                console.log("Proposal %d created", i);
            }
            
            const firsrPropId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("2"));
            await saltDAO.connect(user1).voteForProposal(firsrPropId, true);
            console.log("User1 agreed with proposal '2'");
            await saltDAO.connect(user2).voteForProposal(firsrPropId, true);
            console.log("User2 agreed with proposal '2'");

            const propId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Last proposal"));
            await saltDAO.connect(user1).addNewProposal(propId);
            console.log("New proposal created");
           
            const blockNumber = await time.latestBlock();
            const timestamp = await time.latest();

            const [event] = await saltDAO.queryFilter(saltDAO.filters.ProposalCreated(propId, null, null, null));
            expect(event.args.proposalId).to.equal(propId);
            expect(event.args.expiration).to.equal(timestamp + 3 * 24 * 60 * 60);
            console.log("Values of event 'ProposalCreated' are correct");

            const activeProposals = (await saltDAO.getProposals());

            expect(activeProposals.length).to.equal(proposalLimit);
            
            const proposal = activeProposals.find(prop => prop.id === propId)!;
            expect(proposal.agreements).to.equal(0);
            expect(proposal.disagreements).to.equal(0);
            expect(proposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(proposal.createdAtBlock).to.equal(blockNumber);
            console.log("Values of proposal from 'getProposals()' are correct");
            
            const sameProposal = await saltDAO.getProposal(propId)
            expect(sameProposal.agreements).to.equal(0);
            expect(sameProposal.disagreements).to.equal(0);
            expect(sameProposal.ttl).to.equal(timestamp + 3 * 24 * 60 * 60);
            expect(sameProposal.createdAtBlock).to.equal(blockNumber);
            console.log("Values of proposal from 'getProposal(id)' are correct");
        });
    });

    describe("Voting", function () {
        it("Vote should work corrclty", async function () {
            const { saltDAO, user1} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await saltDAO.connect(user1).voteForProposal(prop, true);
            console.log("User1 agreed with proposal");

            const [event] = await saltDAO.queryFilter(saltDAO.filters.VoteCounted(null, null, null, null));

            expect(event.args.proposalId).to.equal(prop);
            expect(event.args.voter).to.equal(user1.address);
            expect(event.args.weight).to.equal(25 * 10 ** 6);
            expect(event.args.agreed).to.equal(true);
            console.log("Values of event 'VoteCounted' are correct");

            const vote = await saltDAO.getVote(prop);
            expect(vote.weight).to.equal(25 * 10 ** 6);
            expect(vote.isAgreed).to.equal(true);
            console.log("Values of vote from 'getVote(id)' are correct");
        }); 

        it("Vote should return error if proposal doesn't exists", async function () {
            const { saltDAO, user1} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));

            await expect(saltDAO.connect(user1).voteForProposal(prop, true)).to.be.revertedWith("Proposal does not exist");
            console.log("User1 vote reverted because proposal does not exists");
        });

        it("Vote should return error if proposal is expired", async function () {
            const { saltDAO, user1} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await time.increase(4 * 24 * 60 * 60);

            await expect(saltDAO.connect(user1).voteForProposal(prop, true)).to.be.revertedWith("Proposal is expired or already accepted/declined");
            console.log("User1 vote reverted because proposal was expired");
        });

        it("Vote should return error if had not enough balance", async function () {
            const { saltDAO, user3, user4} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user3).addNewProposal(prop);
            console.log("New proposal created");

            await expect(saltDAO.connect(user4).voteForProposal(prop, true)).to.be.revertedWith("You had not enough tokens when proposal was added");
            console.log("User4 vote reverted because he has no tokens at all");
        });

        it("User can revote correctly", async function () {
            const { saltDAO, user1} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await saltDAO.connect(user1).voteForProposal(prop, true);
            console.log("User1 agreed with proposal");

            await saltDAO.connect(user1).voteForProposal(prop, false);
            console.log("User1 disagreed with proposal");

            const [_, event] = await saltDAO.queryFilter(saltDAO.filters.VoteCounted(null, null, null, null));

            expect(event.args.proposalId).to.equal(prop);
            expect(event.args.voter).to.equal(user1.address);
            expect(event.args.weight).to.equal(25 * 10 ** 6);
            expect(event.args.agreed).to.equal(false);
            console.log("Values of event 'VoteCounted' are correct");

            const vote = await saltDAO.getVote(prop);
            expect(vote.weight).to.equal(25 * 10 ** 6);
            expect(vote.isAgreed).to.equal(false);
            console.log("Values of vote from 'getVote(id)' are correct");
        });

        it("User can delegate all votes to another one", async function () {
            const { salt, saltDAO, user1, user2, user3, user4} = await loadFixture(deployDao3UsersWithBalances);

            await salt.connect(user1).delegate(user4.address);
            console.log("User1 delegated to User4");
            await salt.connect(user2).delegate(user4.address);
            console.log("User2 delegated to User4");
            await salt.connect(user3).delegate(user4.address);
            console.log("User3 delegated to User4");

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");
            
            await saltDAO.connect(user4).voteForProposal(prop, true);
            console.log("User4 voted with delegated weight");

            const [event] = await saltDAO.queryFilter(saltDAO.filters.VoteCounted(null, null, null, null));

            expect(event.args.proposalId).to.equal(prop);
            expect(event.args.voter).to.equal(user4.address);
            expect(event.args.weight).to.equal(100 * 10 ** 6);
            expect(event.args.agreed).to.equal(true);
            console.log("Values of event 'VoteCounted' are correct")

            const vote = await saltDAO.connect(user4).getVote(prop)
            expect(vote.weight).to.equal(100 * 10 ** 6);
            expect(vote.isAgreed).to.equal(true);
            console.log("Values of vote from 'getVote(id)' are correct")
        });

        it("Vote should return error after delegation", async function () {
            const { salt, saltDAO, user1, user4} = await loadFixture(deployDao3UsersWithBalances);

            await salt.connect(user1).delegate(user4.address);
            console.log("User1 delegated to User4");

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await expect(saltDAO.connect(user1).voteForProposal(prop, true)).to.be.revertedWith("You had not enough tokens when proposal was added");
            console.log("User1 vote reverted because of delegation of all tokens to user 4");
        });

        it("Vote should return error if delegated after proposal", async function () {
            const { salt, saltDAO, user1, user2, user3, user4} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await salt.connect(user1).delegate(user4.address);
            console.log("User1 delegated to User4");
            await salt.connect(user2).delegate(user4.address);
            console.log("User2 delegated to User4");
            await salt.connect(user3).delegate(user4.address);
            console.log("User3 delegated to User4");

            await expect(saltDAO.connect(user4).voteForProposal(prop, true)).to.be.revertedWith("You had not enough tokens when proposal was added");
            console.log("User4 vote reverted because delegation was after proposal was created");
        });

        it("Vote should return error if proposal is finished", async function () {
            const { saltDAO, user1, user2, user3} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await saltDAO.connect(user1).voteForProposal(prop, true);
            console.log("User1 voted for agreement with his %d weight", (await saltDAO.connect(user1).getVote(prop)).weight);
            await saltDAO.connect(user2).voteForProposal(prop, true);
            console.log("User2 voted for agreement with his %d weight", (await saltDAO.connect(user2).getVote(prop)).weight);

            await expect(saltDAO.connect(user3).voteForProposal(prop, true)).to.be.revertedWith("Proposal is expired or already accepted/declined");
            console.log("User3 vote reverted correctly");
        });
    });

    describe("Vote result", async function () {
        it("Voting finished and proposal is accepted after threshhold is reached", async function () {
            const { saltDAO, user1, user2} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await saltDAO.connect(user1).voteForProposal(prop, true);
            console.log("User1 voted for agreement with his %d weight", (await saltDAO.connect(user1).getVote(prop)).weight);
            await saltDAO.connect(user2).voteForProposal(prop, true);
            console.log("User2 voted for agreement with his %d weight", (await saltDAO.connect(user2).getVote(prop)).weight);
        
            const [event] = await saltDAO.queryFilter(saltDAO.filters.ProposalVotingFinished(null, null, null, null));

            expect(event.args.proposalId).to.equal(prop);
            expect(event.args.accepted).to.equal(true);
            expect(event.args.agreements).to.equal(65 * 10 ** 6);
            expect(event.args.disagreements).to.equal(0);
            console.log("Values of event 'ProposalVotingFinished' are correct");
        });

        it("Voting finished and proposal is rejected after threshhold is reached", async function () {
            const { saltDAO, user1, user2} = await loadFixture(deployDao3UsersWithBalances);

            const prop = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Proposal 1"));
            await saltDAO.connect(user1).addNewProposal(prop);
            console.log("New proposal created");

            await saltDAO.connect(user1).voteForProposal(prop, false);
            console.log("User1 voted for disagreement with his %d weight", (await saltDAO.connect(user1).getVote(prop)).weight);
            await saltDAO.connect(user2).voteForProposal(prop, false);
            console.log("User2 voted for disagreement with his %d weight", (await saltDAO.connect(user2).getVote(prop)).weight);


            const [event] = await saltDAO.queryFilter(saltDAO.filters.ProposalVotingFinished(null, null, null, null));

            expect(event.args.proposalId).to.equal(prop);
            expect(event.args.accepted).to.equal(false);
            expect(event.args.agreements).to.equal(0);
            expect(event.args.disagreements).to.equal(65 * 10 ** 6);
            console.log("Values of event 'ProposalVotingFinished' are correct");
        })
    });


});