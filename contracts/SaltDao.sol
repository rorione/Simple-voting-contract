// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract SaltDao {

    /*
     *  Constants
     */
    uint8 public constant PROPOSALS_MAX_COUNT = 3;
    uint256 public constant VOTING_DURATION = 3 days;

    /*
     *  Storage
     */
    ERC20Votes public token;
    mapping (address => mapping (bytes32 => Vote)) votes;
    mapping (bytes32 => uint8) proposalIndex;

    // 0 index is occupied and forbidden to use because of [proposalIndex] default mapping to 0
    Proposal[PROPOSALS_MAX_COUNT + 1] private proposals;

    struct Proposal {
        bytes32 id;
        uint256 disagreements;
        uint256 agreements;
        uint256 ttl;
        uint256 createdAtBlock;
    }

    struct Vote {
        bool isAgreed;
        uint256 weight;
    }

    /*
     *  Events
     */
    event ProposalCreated(bytes32 indexed proposalId, uint256 expiration, uint256 startBlock,  address indexed author);
    event VoteCounted(bytes32 indexed proposalId, address indexed voter, uint256 weight, bool agreed);
    event ProposalVotingFinished(bytes32 indexed proposalId, bool accepted, uint256 agreements, uint256 disagreements);

    /*
     *  Modifiers
     */
    modifier hasVotingPower {
        require(
            token.balanceOf(msg.sender) > 0,
            "Not enough balance"
        );
        _;
    }

    modifier newProposal(bytes32 _proposalId) {
        require(
            proposalIndex[_proposalId] == 0,
            "Proposal already exists"
        );
        _;
    }

    /*
     * Constructor
     */
    /// @dev Contract constructor sets initial token.
    /// @param _token Token to be set.
    constructor(address _token) {
        token = ERC20Votes(_token);
    }

    /*
     * External functions
     */
    /// @dev Adds new proposal. Finds first non-existing\rejected\accepted\expired proposal slot and puts new proposal into it. 
    /// @param _proposalId Proposal hashcode.
    function addNewProposal(bytes32 _proposalId) 
        external 
        hasVotingPower 
        newProposal(_proposalId) 
    {
        uint8 newProposalIdx = 0;

        for(uint8 i = 1; i <= PROPOSALS_MAX_COUNT; i++) {
            if (proposals[i].ttl < block.timestamp) {
                newProposalIdx = i;
                break;
            }
        }

        require(
            newProposalIdx != 0,
            "All proposal slots are occupied"
        );

        proposalIndex[_proposalId] = newProposalIdx;
        proposals[newProposalIdx] = Proposal({
            id: _proposalId,
            disagreements: 0,
            agreements: 0,
            ttl: block.timestamp + VOTING_DURATION,
            createdAtBlock: block.number
        });


        emit ProposalCreated(_proposalId, block.timestamp + VOTING_DURATION, block.number, msg.sender);   
    }

    /// @dev Votes for active existing proposal. If you already voted then your previous vote will be reverted and new one will be used. 
    ///      Your vote weight is always your tokens amount at the proposal creation moment.
    /// @param _proposalId Proposal hashcode.
    /// @param isAgreed If true then you are agreed with proposal and disagreed otherwise.
    function voteForProposal(bytes32 _proposalId, bool isAgreed) 
        external 
    {
        Proposal storage proposal = _getProposal(_proposalId);

        uint256 weight = token.getPastVotes(msg.sender, proposal.createdAtBlock);
        require(
            weight > 0,
            "You had not enough tokens when proposal was added"
        );

        Vote storage currentVote = votes[msg.sender][_proposalId];
        
        // reverting old vote
        if (currentVote.isAgreed) {
            proposal.agreements -= currentVote.weight;
        } else {
            proposal.disagreements -= currentVote.weight;
        }

        // voting
        if (isAgreed) {
            proposal.agreements += weight;
        } else {
            proposal.disagreements += weight;
        }

        // updating vote
        currentVote.isAgreed = isAgreed;
        currentVote.weight = weight;

        emit VoteCounted(_proposalId, msg.sender, weight, isAgreed);
        
        _checkIsVotingFinished(_proposalId);
    }

    /*
     * View functions
     */
    /// @dev Shows your current proposal vote.
    /// @param _proposalId Proposal hashcode.
    /// @return Your vote info for selected proposal.
    function getVote(bytes32 _proposalId) 
        external 
        view 
        returns (Vote memory) 
    {
        return votes[msg.sender][_proposalId];
    }

    /// @dev Shows active proposal by its id.
    /// @param _proposalId Proposal hashcode.
    /// @return Active proposal.
    function getProposal(bytes32 _proposalId) 
        external 
        view 
        returns (Proposal memory) 
    {
        return _getProposal(_proposalId);
    }

    /// @dev Shows all proposals in contract. Proposals with exceed ttl are nonconsistant.
    /// @return Contract proposals.
    function getProposals() 
        external 
        view 
        returns (Proposal[] memory) 
    {
        Proposal[] memory mProposals = new Proposal[](PROPOSALS_MAX_COUNT);
        for(uint8 i = 0; i < PROPOSALS_MAX_COUNT; i++) {
            mProposals[i] = proposals[i + 1];
        }
        return mProposals;
    }

    /*
     * Internal functions
     */ 
    /// @dev Checks if proposal can be accepted or rejected.
    /// @param _proposalId proposals to be checked.
    function _checkIsVotingFinished(bytes32 _proposalId) 
        internal 
    {
        Proposal storage proposal = proposals[proposalIndex[_proposalId]];
        uint256 totalSupply = token.getPastTotalSupply(proposal.createdAtBlock);

        if (proposal.agreements > totalSupply / 2) {
            proposal.ttl = 0;
            emit ProposalVotingFinished(_proposalId, true, proposal.agreements, proposal.disagreements);
        } else if (proposal.disagreements > totalSupply / 2) {
            proposal.ttl = 0;
            emit ProposalVotingFinished(_proposalId, false, proposal.agreements, proposal.disagreements);
        }
    }

    /// @dev Returns active proposal without coping.
    /// @param _proposalId Proposal hashcode.
    /// @return Active proposal.
    function _getProposal(bytes32 _proposalId) 
        internal 
        view 
        returns (Proposal storage) 
    {
        uint8 index = proposalIndex[_proposalId];
        require(
            index != 0,
            "Proposal does not exist"
        );

        Proposal storage proposal = proposals[index];
        require(
            proposal.ttl > block.timestamp,
            "Proposal is expired or already accepted/declined"
        );

        return proposal;
    }
}