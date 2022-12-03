// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract SaltToken is ERC20Votes {
    constructor() ERC20("SaltToken", "SLT") ERC20Permit("SaltToken") {
        _mint(msg.sender, 100 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
