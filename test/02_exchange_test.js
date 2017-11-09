let exchange = artifacts.require('./Exchange.sol');
let fixedSupplyToken = artifacts.require('./FixedSupplyToken.sol');

contract('Exchange', function(accounts) {

	it("should be able to deposit and withdraw ether", function() {

		let exchangeInstance;
		let balanceBeforeTransaction = web3.eth.getBalance(accounts[0]);
		let balanceAfterDeposit;
		let balanceAfterWithdraw;
		let gasUsed = 0;

		return exchange.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.depositEther({from: accounts[0], value: web3.toWei(1, "ether")});
		}).then(function(txHash) {
			// Get how much gas was used in ether
			gasUsed += txHash.receipt.cumulativeGasUsed * web3.eth.getTransaction(txHash.receipt.transactionHash).gasPrice.toNumber();
			balanceAfterDeposit = web3.eth.getBalance(accounts[0]);
			return exchangeInstance.getEthBalanceInWei();
		}).then(function(balanceInWei) {
			// Should be one ether in the exchange under account 0
			assert.equal(balanceInWei.toNumber(), web3.toWei(1, "ether"), "There should be one ether available");
			// Balance difference before and after this transaction should be  at least 1 ether (sent 1 ether + gas fee)
			assert.isAtLeast(balanceBeforeTransaction.toNumber() - balanceAfterDeposit.toNumber(), web3.toWei(1, "ether"), "Balance difference should be at least 1 ether");
			return exchangeInstance.withdrawEther(web3.toWei(1, 'ether'));
		}).then(function(txHash) {
			balanceAfterWithdraw = web3.eth.getBalance(accounts[0]);
			return exchangeInstance.getEthBalanceInWei();
		}).then(function(balanceInWei) {
			assert.equal(balanceInWei.toNumber(), 0, "There should be no more ether available in the exchange.");
			assert.isAtLeast(balanceAfterWithdraw.toNumber(), balanceBeforeTransaction.toNumber() - gasUsed*2, "There should be sufficient ether remaining in the account after the withdraw");
		})

	});

	it("should be able to add a token", function() {

		let myTokenInstance;
		let myExchangeInstance;
		let tokenSymbol = 'FIXED';

		return fixedSupplyToken.deployed().then(function(instance){
			myTokenInstance = instance;
			return exchange.deployed();
		}).then(function(instance) {
			myExchangeInstance = instance;
			// Add the token to the exchange
			return myExchangeInstance.addToken(tokenSymbol, myTokenInstance.address);
		}).then(function(txResult) {
			assert.equal(txResult.logs[0].event, "TokenAddedToSystem", "TokenAddedToSystem event was not emitted");
			// Check if the token exists
			return myExchangeInstance.hasToken(tokenSymbol);
		}).then(function(booleanHasToken) {
			assert.equal(booleanHasToken, true, "Token was not added to the exchange");
			// Check if a dummy token exists
			return myExchangeInstance.hasToken("UNKNOWN");
		}).then(function(booleanHasNotToken) {
			assert.equal(booleanHasNotToken, false, "A token that doesn't exist was magically added to the exchange");
		})

	});

	it("should allow a user to deposit tokens", function() {

		let myTokenInstance;
		let exchangeInstance;
		let tokenSymbol = 'FIXED';
		let depositAmount = 100;

		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return exchange.deployed();
		}).then(function(instance) {
			exchangeInstance = instance;
			return myTokenInstance.approve(exchangeInstance.address, depositAmount, {from: accounts[0]});
		}).then(function(txResult) {
			// assert.equal(response, true, "Exchange should have been approved to spend " + depositAmount + " tokens");
			return exchangeInstance.depositToken(tokenSymbol, depositAmount, {from: accounts[0]});
		}).then(function(txResult) {
			return exchangeInstance.getBalance(tokenSymbol, {from: accounts[0]});
		}).then(function(balance) {
			assert.equal(balance.toNumber(), depositAmount, "Should have deposited " + depositAmount + " tokens into the exchange from account 0");
		})

	});

	it("should allow a user to withdraw tokens", function() {

		let myTokenInstance;
		let exchangeInstance;
		let tokenSymbol = 'FIXED';
		let depositAmount = 100;

		let initialTokenBalance;
		let initialExchangeTokenBalance;

		return fixedSupplyToken.deployed().then(function(instance) {
			myTokenInstance = instance;
			return exchange.deployed();
		}).then(function(instance) {
			exchangeInstance = instance;
			return myTokenInstance.balanceOf(accounts[0]);
		}).then(function(balance) {
			// Get the initial token balance of account 0 before withdrawing anything
			initialTokenBalance = balance.toNumber();
			return exchangeInstance.getBalance(tokenSymbol);
		}).then(function(balance) {
			initialExchangeTokenBalance = balance.toNumber();
			return exchangeInstance.withdrawToken(tokenSymbol, depositAmount, {from: accounts[0]});
		}).then(function(txResult) {
			// Get the remaining token balance in the exchange for account 0
			return exchangeInstance.getBalance(tokenSymbol, {from: accounts[0]});
		}).then(function(balance) {
			// Make sure that the difference in exchange balance is depositAmount
			assert.equal(initialExchangeTokenBalance - balance.toNumber(), depositAmount, "Shouldn't have any token balance left in the exchange");
			return myTokenInstance.balanceOf(accounts[0]);
		}).then(function(tokenBalance) {
			// Make sure that the balance on the token side is increased by depositAmount
			assert.equal(tokenBalance.toNumber() - initialTokenBalance, depositAmount, "Should've returned all " + depositAmount + " tokens back into account 0");
		})

	});

});