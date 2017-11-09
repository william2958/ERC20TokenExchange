let fixedSupplyToken = artifacts.require('./FixedSupplyToken.sol');

const TOTAL_SUPPLY_TOKENS = 1000000;

contract('MyToken', function(accounts) {

	it("should verify the first account has all the tokens", function() {
		let _totalSupply;
		let myTokenInstance;
		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return myTokenInstance.totalSupply.call();
		}).then(function(totalSupply) {
			_totalSupply = totalSupply;
			return myTokenInstance.balanceOf(accounts[0]);
		}).then(function(balanceAccountOwner) {
			assert.equal(balanceAccountOwner.toNumber(), _totalSupply.toNumber(), "Total Amount of tokens is owned by the owner");
			assert.equal(_totalSupply.toNumber(), TOTAL_SUPPLY_TOKENS, "Total amount of tokens generated is designated amount");
		})
	});

	it("should verify that the second account doesn't have any tokens", function() {
		let myTokenInstance;
		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return myTokenInstance.balanceOf(accounts[1]);
		}).then(function(balanceSecondAccount) {
			assert.equal(balanceSecondAccount.toNumber(), 0, "Second account should have zero tokens.")
		})
	});

	it("should send tokens correctly", function() {

		let myTokenInstance;

		let account_one = accounts[0];
		let account_two = accounts[1];

		let account_one_starting_balance;
		let account_two_starting_balance;
		let account_one_ending_balance;
		let account_two_ending_balance;

		let amount = 10;

		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return myTokenInstance.balanceOf(account_one);
		}).then(function(balance) {
			account_one_starting_balance = balance.toNumber();
			return myTokenInstance.balanceOf(account_two);
		}).then(function(balance) {
			account_two_starting_balance = balance.toNumber();
			return myTokenInstance.transfer(account_two, amount, {from: account_one});
		}).then(function(txReceipt) {
			return myTokenInstance.balanceOf(account_one);
		}).then(function(balance) {
			account_one_ending_balance = balance.toNumber();
			return myTokenInstance.balanceOf(account_two);
		}).then(function(balance) {
			account_two_ending_balance = balance.toNumber();

			assert.equal(account_one_ending_balance, account_one_starting_balance - amount, "Amount wasn't taken correctly from the sender");
			assert.equal(account_two_ending_balance, account_two_starting_balance + amount, "Amount wasn't sent correct to the receiver");
		})

	});

});