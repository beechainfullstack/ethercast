// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Affirmations {
    struct Affirmation {
        bytes32 affirmationHash;
        address author;
        uint256 createdAt;
        uint256 effectiveAt;
    }

    event AffirmationCreated(
        bytes32 indexed affirmationHash,
        address indexed author,
        uint256 createdAt,
        uint256 effectiveAt
    );

    Affirmation[] public affirmations;

    function createAffirmation(bytes32 affirmationHash, uint256 effectiveAt) external {
        require(effectiveAt > block.timestamp, "effectiveAt must be future");

        Affirmation memory a = Affirmation({
            affirmationHash: affirmationHash,
            author: msg.sender,
            createdAt: block.timestamp,
            effectiveAt: effectiveAt
        });

        affirmations.push(a);

        emit AffirmationCreated(affirmationHash, msg.sender, a.createdAt, a.effectiveAt);
    }

    function getAffirmations() external view returns (Affirmation[] memory) {
        return affirmations;
    }
}
