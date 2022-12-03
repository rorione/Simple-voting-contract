# Simple voting contract

A contract that allows users to vote for proposals, using token balances. Users own an ERC20Votes token, representing “voting power”. Proposals are simply the keccak256 hashes and can be “accepted”, “rejected” or “expired” (if TTL of proposal is expired). The fact of acceptance of a proposal is fixed in the event.

## How to use

To use contract you shuld delegate ERC20Votes(Salt token is used here) token to address.
Then you can create a proposal (providing its keccak256 hash) or vote for existing (providing its keccak256 hash and your acceptance).
Your vote power is full amount of your tokens on the proposal creation moment!
Address can chancge its acceptance using vote again.
Each proposal has its own TTL (3 days). After that, if it wasn't “accepted” or “rejected”, it will be discarded and voting for or against it will be unavailable.
At the same time only 3 proposals can exist. New one can be added only after any existing proposal will be “accepted”, “rejected” or “expired”.
Contract stores full Vote history, but doesn't store non active proposals. Use events to search for old proposals.

## Tests 

Run following command:
```shell
npx hardhat test
```
### Output example:

```shell
  Salt Token
    Transfers
      ✔ Transfer between addresses shoud succeed (1110ms)
      ✔ Transfer between addresses shoud fail (85ms)
    Init
      ✔ Token has correct name (67ms)
      ✔ Token has correct totalSupply (51ms)
      ✔ Token has correct decimals (53ms)
      ✔ Token has correct symbol (52ms)

  SaltDao
    Deployment
      ✔ Should be right balances (145ms)
      ✔ Should be right totalSupply
      ✔ Proposals list should contain only expired proposals
    Create proposal
New proposal created
Event 'ProposalCreated' values are as expected
New proposal arrived in 'getProposals()' and has correct values
New proposal arrived in 'getProposal(id)' and has correct values
      ✔ Should create new proposal corrctly
New proposal creation reverted because such proposal already exists
      ✔ Creating already exising proposal should return error
New proposal creation reverted because address had no tokens at all
      ✔ Creating proposal by address without tokens should return error
Added 3 proposals
New proposal creation reverted because all proposal slots are occupied
      ✔ Creating proposal when all proposal slots are occupied should return error (47ms)
Proposal 0 created
Skipped 1 day
Proposal 1 created
Skipped 1 day
Proposal 2 created
Skipped 1 day
New proposal created
Values of event 'ProposalCreated' are correct
Values of proposal from 'getProposals()' are correct
Values of proposal from 'getProposal(id)' are correct
      ✔ Should create new proposal corrctly if one of them is expired (74ms)
Proposal 0 created
Proposal 1 created
Proposal 2 created
User1 agreed with proposal '2'
User2 agreed with proposal '2'
New proposal created
Values of event 'ProposalCreated' are correct
Values of proposal from 'getProposals()' are correct
Values of proposal from 'getProposal(id)' are correct
      ✔ Should create new proposal corrctly if one of them is accepted (94ms)
    Voting
New proposal created
User1 agreed with proposal
Values of event 'VoteCounted' are correct
Values of vote from 'getVote(id)' are correct
      ✔ Vote should work corrclty (38ms)
User1 vote reverted because proposal does not exists
      ✔ Vote should return error if proposal doesn't exists
New proposal created
User1 vote reverted because proposal was expired
      ✔ Vote should return error if proposal is expired
New proposal created
User4 vote reverted because he has no tokens at all
      ✔ Vote should return error if had not enough balance
New proposal created
User1 agreed with proposal
User1 disagreed with proposal
Values of event 'VoteCounted' are correct
Values of vote from 'getVote(id)' are correct
      ✔ User can revote correctly (43ms)
User1 delegated to User4
User2 delegated to User4
User3 delegated to User4
New proposal created
User4 voted with delegated weight
Values of event 'VoteCounted' are correct
Values of vote from 'getVote(id)' are correct
      ✔ User can delegate all votes to another one (72ms)
User1 delegated to User4
New proposal created
User1 vote reverted because of delegation of all tokens to user 4
      ✔ Vote should return error after delegation (46ms)
New proposal created
User1 delegated to User4
User2 delegated to User4
User3 delegated to User4
User4 vote reverted because delegation was after proposal was created
      ✔ Vote should return error if delegated after proposal (52ms)
New proposal created
User1 voted for agreement with his 25000000 weight
User2 voted for agreement with his 40000000 weight
User3 vote reverted correctly
      ✔ Vote should return error if proposal is finished (59ms)
    Vote result
New proposal created
User1 voted for agreement with his 25000000 weight
User2 voted for agreement with his 40000000 weight
Values of event 'ProposalVotingFinished' are correct
      ✔ Voting finished and proposal is accepted after threshhold is reached (43ms)
New proposal created
User1 voted for disagreement with his 25000000 weight
User2 voted for disagreement with his 40000000 weight
Values of event 'ProposalVotingFinished' are correct
      ✔ Voting finished and proposal is rejected after threshhold is reached (47ms)


  26 passing (2s)
```
