// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlitzSavings
 * @notice Auto-savings vault for BlitzPay on Rootstock.
 *         Users deposit RBTC and can withdraw at any time.
 *         Supports per-user savings rules (percentage of incoming funds).
 *
 * Deploy on Rootstock Testnet (chain ID 31).
 */
contract BlitzSavings {
    // ── Events ───────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 remaining);
    event SavingsRuleSet(address indexed user, uint8 percentage);
    event SavingsRuleRemoved(address indexed user);

    // ── Storage ──────────────────────────────────────────────────────────────

    /// @dev RBTC balance held for each user
    mapping(address => uint256) private _balances;

    /// @dev Auto-save percentage (0 = no rule, 1–100 = active)
    mapping(address => uint8) private _savingsRules;

    // ── External functions ───────────────────────────────────────────────────

    /**
     * @notice Deposit RBTC into the savings vault.
     */
    function deposit() external payable {
        require(msg.value > 0, "BlitzSavings: deposit amount must be > 0");
        _balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, _balances[msg.sender]);
    }

    /**
     * @notice Withdraw RBTC from the savings vault.
     * @param amount Amount in wei to withdraw.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "BlitzSavings: withdraw amount must be > 0");
        require(
            _balances[msg.sender] >= amount,
            "BlitzSavings: insufficient balance"
        );

        _balances[msg.sender] -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "BlitzSavings: transfer failed");

        emit Withdrawn(msg.sender, amount, _balances[msg.sender]);
    }

    /**
     * @notice Get the savings balance of a user.
     * @param user Wallet address to query.
     * @return balance Balance in wei.
     */
    function getBalance(address user) external view returns (uint256 balance) {
        return _balances[user];
    }

    /**
     * @notice Set an auto-savings rule for the caller.
     * @param percentage Percentage of income to auto-save (1–100).
     */
    function setSavingsRule(uint8 percentage) external {
        require(
            percentage >= 1 && percentage <= 100,
            "BlitzSavings: percentage must be 1-100"
        );
        _savingsRules[msg.sender] = percentage;
        emit SavingsRuleSet(msg.sender, percentage);
    }

    /**
     * @notice Remove the auto-savings rule for the caller.
     */
    function removeSavingsRule() external {
        require(_savingsRules[msg.sender] > 0, "BlitzSavings: no active rule");
        _savingsRules[msg.sender] = 0;
        emit SavingsRuleRemoved(msg.sender);
    }

    /**
     * @notice Get the savings rule percentage for a user.
     * @param user Wallet address to query.
     * @return percentage 0 if no rule, otherwise 1–100.
     */
    function getSavingsRule(
        address user
    ) external view returns (uint8 percentage) {
        return _savingsRules[user];
    }

    /**
     * @notice Deposit on behalf of a user (called by BlitzPay backend for auto-save).
     * @param user The user whose balance to credit.
     */
    function depositFor(address user) external payable {
        require(user != address(0), "BlitzSavings: zero address");
        require(msg.value > 0, "BlitzSavings: deposit amount must be > 0");
        _balances[user] += msg.value;
        emit Deposited(user, msg.value, _balances[user]);
    }

    // Reject plain ETH transfers — use deposit() explicitly
    receive() external payable {
        revert("BlitzSavings: use deposit()");
    }
}
