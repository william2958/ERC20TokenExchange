let fixedSupplyToken = artifacts.require("./FixedSupplyToken.sol");

contract('Sell Token Tests', function(accounts) {
	it("first account should own all tokens", function() {
		let _totalSupply;
		let myTokenInstance;
		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return myTokenInstance.totalSupply.call();
		}).then(function(totalSupply) {
			_totalSupply = totalSupply;
			return myTokenInstance.balanceOf(accounts[0]);
		}).then(function(balanceAccountOwner) {
			assert.equal(balanceAccountOwner.toNumber(), _totalSupply.toNumber(), "Total Amount of tokens is owned by owner");
		});
	});

	it("second account should own no tokens", function() {
		let myTokenInstance;
		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return myTokenInstance.balanceOf(accounts[1]);
		}).then(function(balanceAccountOwner) {
			assert.equal(balanceAccountOwner.toNumber(), 0, "Total Amount of tokens is owned by some other address");
		});
	});



	it("should send token correctly", function() {
		let token;

		//    Get initial balances of first and second account.
		let account_one = accounts[0];
		let account_two = accounts[1];

		let account_one_starting_balance;
		let account_two_starting_balance;
		let account_one_ending_balance;
		let account_two_ending_balance;

		let amount = 10;

		return fixedSupplyToken.deployed().then(function(instance) {
			token = instance;
			return token.balanceOf.call(account_one);
		}).then(function(balance) {
			account_one_starting_balance = balance.toNumber();
			return token.balanceOf.call(account_two);
		}).then(function(balance) {
			account_two_starting_balance = balance.toNumber();
			return token.transfer(account_two, amount, {from: account_one});
		}).then(function() {
			return token.balanceOf.call(account_one);
		}).then(function(balance) {
			account_one_ending_balance = balance.toNumber();
			return token.balanceOf.call(account_two);
		}).then(function(balance) {
			account_two_ending_balance = balance.toNumber();

			assert.equal(account_one_ending_balance, account_one_starting_balance - amount, "Amount wasn't correctly taken from the sender");
			assert.equal(account_two_ending_balance, account_two_starting_balance + amount, "Amount wasn't correctly sent to the receiver");
		});
	});
});