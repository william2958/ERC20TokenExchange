// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import exchange_artifacts from '../Exchange.json'
import token_artifacts from '../FixedSupplyToken.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
let ExchangeContract = contract(exchange_artifacts);
let TokenContract = contract(token_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
let accounts;
let account;

window.App = {
	start: function() {
		//bootstrap everything
		let self = this;

		ExchangeContract.setProvider(web3.currentProvider);
		TokenContract.setProvider(web3.currentProvider);

		// Get the initial account balance so it can be displayed
		web3.eth.getAccounts(function(err, accs) {
			if (err !== null) {
				alert("There was an error fetching your accounts.");
				return;
			}

			if (accs.length === 0) {
				alert("Couldn't get any accounts! Make sure your ethereum client is configured correctly");
				return;
			}

			accounts = accs;
			account = accounts[0];
		})

	},

	setStatus: function(message) {
		let status = document.getElementById("status");
		status.innerHTML = message;
	},
	printImportantInformation: function() {
		//print out some important information
		ExchangeContract.deployed().then(function(instance) {
			let divAddress = document.createElement("div");
			divAddress.appendChild(document.createTextNode("Address Exchange: " + instance.address));
			divAddress.setAttribute("class", "alert alert-info");
			document.getElementById("importantInformation").appendChild(divAddress);
		});
		TokenContract.deployed().then(function(instance) {
			let divAddress = document.createElement("div");
			divAddress.appendChild(document.createTextNode("Address Token: " + instance.address));
			divAddress.setAttribute("class", "alert alert-info");
			document.getElementById("importantInformation").appendChild(divAddress);
		});

		web3.eth.getAccounts(function(err, accs) {
			web3.eth.getBalance(accs[0], function(err1, balance) {
				let divAddress = document.createElement("div");
				let div = document.createElement("div");
				div.appendChild(document.createTextNode("Active Account: " + accs[0]));
				let div2 = document.createElement("div");
				div2.appendChild(document.createTextNode("Balance in Ether: " + web3.fromWei(balance, "ether")));
				divAddress.appendChild(div);
				divAddress.appendChild(div2);
				divAddress.setAttribute("class", "alert alert-info");
				document.getElementById("importantInformation").appendChild(divAddress);
			});

		});
	},
	/**
	 * Exchange specific functions here
	 */
	initExchange: function() {
		//init Exchange
		App.refreshBalanceExchange();
		App.printImportantInformation();
		App.watchExchangeEvents();
	},
	watchExchangeEvents: function() {
		//watch for Exchange Events
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			exchangeInstance.allEvents({},{fromBlock:0, toBlock:'latest'}).watch(function(error, result) {
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info  alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: '+result.event+'</strong>';
				alertbox.appendChild(eventTitle);


				let argsBox = document.createElement("textarea");
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText= JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("exchangeEvents").appendChild(alertbox);
				//document.getElementById("tokenEvents").innerHTML += '<div class="alert alert-info  alert-dismissible" role="alert"> <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><div></div><div>Args: '+JSON.stringify(result.args) + '</div></div>';

			});
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log.");
		});
	},
	addTokenToExchange: function() {
		//function to add tokens to the exchange

		let nameOfToken = document.getElementById('inputNameTokenAddExchange').value;
		let addressOfToken = document.getElementById("inputAddressTokenAddExchange").value;
		ExchangeContract.deployed().then(function(instance) {
			return instance.addToken(nameOfToken, addressOfToken, {from: account});
		}).then(function(txResult) {
			console.log('Transaction added result: ', txResult);
			App.setStatus('Token added');
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log.");
		});

	},
	refreshBalanceExchange: function() {
		//refresh your balance
		let self = this;
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.getBalance('FIXED', {from: account});
		}).then(function(value) {
			console.log('exchange token balance', value);
			let balance_element = document.getElementById('balanceTokenInExchange');
			balance_element.innerHTML = value.toNumber();
			return exchangeInstance.getEthBalanceInWei({from: account});
		}).then(function(value) {
			let balance_element = document.getElementById('balanceEtherInExchange');
			balance_element.innerHTML = web3.fromWei(value, "ether");
		}).catch(function(e) {
			console.log(e);
			self.setStatus("Error getting balance; see log");
		});
	},
	depositEther: function() {
		//deposit ether function
		let amountEther = document.getElementById('inputAmountDepositEther').value;
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.depositEther({value: web3.toWei(amountEther, "ether"), from: account});
		}).then(function(txResult) {
			console.log(txResult);
			App.refreshBalanceExchange();
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log");
		})
	},
	withdrawEther: function() {
		//withdraw ether function
		let amountEther = document.getElementById('inputAmountWithdrawalEther').value;
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.withdrawEther(web3.toWei(amountEther, "ether"), {from: account});
		}).then(function(txResult) {
			console.log(txResult);
			App.refreshBalanceExchange();
			document.getElementById('inputAmountWithdrawalEther').value = '';
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log");
		})
	},
	depositToken: function() {
		//deposit token function
		let amountToken = document.getElementById('inputAmountDepositToken').value;
		let nameToken = document.getElementById('inputNameDepositToken').value;
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.depositToken(nameToken, amountToken, {from: account, gas: 4500000});
		}).then(function(txResult) {
			console.log(txResult);
			App.refreshBalanceExchange();
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log");
		})
	},
	withdrawToken: function() {
		// The withdraw token function
		let nameToken = document.getElementById('inputNameWithdrawalToken').value;
		let amountTokens = document.getElementById('inputAmountWithdrawalToken').value;
		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.withdrawToken(nameToken, amountTokens, {from: account});
		}).then(function(txResult) {
			console.log(txResult);
			App.refreshBalanceExchange();
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log");
		})

	},
	/**
	 * TRADING FUNCTIONS FROM HERE ON
	 */
	initTrading: function() {
		App.refreshBalanceExchange();
		App.printImportantInformation();
		App.updateOrderBooks();
		App.listenToTradingEvents();
	},
	updateOrderBooks: function() {
		//update the order books function
		let exchangeInstance;
		document.getElementById('buyOrderBook').innerHTML = null;
		document.getElementById('sellOrderBook').innerHTML = null;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.getSellOrderBook('FIXED');
		}).then(function(sellOrderBook) {
			console.log(sellOrderBook);
			if (sellOrderBook[0].length === 0) {
				document.getElementById('sellOrderBook').innerHTML = '<span>No Sell Orders at this point</span>';
			}
			for (let i=0; i<sellOrderBook[0].length; i++) {
				document.getElementById('sellOrderBook').innerHTML += '<div>sell ' + sellOrderBook[1][i] + '@' + sellOrderBook[0][i] + '</div>';
			}
			return exchangeInstance.getBuyOrderBook('FIXED');
		}).then(function(buyOrderBook) {
			console.log(buyOrderBook);
			if (buyOrderBook[0].length === 0) {
				document.getElementById('buyOrderBook').innerHTML = '<span>No Buy Orders at this point</span>';
			}
			for (let i=0; i<buyOrderBook[0].length; i++) {
				document.getElementById('buyOrderBook').innerHTML += '<div>buy ' + buyOrderBook[1][i] + '@' + buyOrderBook[0][i] + '</div>';
			}
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log");
		})

	},
	listenToTradingEvents: function() {
		//listen to trading events
		let exchangeInstance;
		ExchangeContract.deployed().then(function (instance) {
			exchangeInstance = instance;

			exchangeInstance.LimitSellOrderCreated({}, {
				fromBlock: 0,
				toBlock: 'latest'
			}).watch(function (error, result) {
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info  alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: ' + result.event + '</strong>';
				alertbox.appendChild(eventTitle);


				let argsBox = document.createElement("textarea");
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText = JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("limitdorderEvents").appendChild(alertbox);
				//document.getElementById("tokenEvents").innerHTML += '<div class="alert alert-info  alert-dismissible" role="alert"> <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><div></div><div>Args: '+JSON.stringify(result.args) + '</div></div>';
			});


			exchangeInstance.LimitBuyOrderCreated({}, {
				fromBlock: 0,
				toBlock: 'latest'
			}).watch(function (error, result) {
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info  alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: ' + result.event + '</strong>';
				alertbox.appendChild(eventTitle);


				let argsBox = document.createElement("textarea");
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText = JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("limitdorderEvents").appendChild(alertbox);
				//document.getElementById("tokenEvents").innerHTML += '<div class="alert alert-info  alert-dismissible" role="alert"> <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><div></div><div>Args: '+JSON.stringify(result.args) + '</div></div>';
			});


			exchangeInstance.SellOrderFulfilled({}, {fromBlock: 0, toBlock: 'latest'}).watch(function (error, result) {
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info  alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: ' + result.event + '</strong>';
				alertbox.appendChild(eventTitle);


				let argsBox = document.createElement("textarea");
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText = JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("fulfilledorderEvents").appendChild(alertbox);
				//document.getElementById("tokenEvents").innerHTML += '<div class="alert alert-info  alert-dismissible" role="alert"> <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><div></div><div>Args: '+JSON.stringify(result.args) + '</div></div>';
			});


			exchangeInstance.BuyOrderFulfilled({}, {fromBlock: 0, toBlock: 'latest'}).watch(function (error, result) {
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info  alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: ' + result.event + '</strong>';
				alertbox.appendChild(eventTitle);


				let argsBox = document.createElement("textarea");
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText = JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("fulfilledorderEvents").appendChild(alertbox);
				//document.getElementById("tokenEvents").innerHTML += '<div class="alert alert-info  alert-dismissible" role="alert"> <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><div></div><div>Args: '+JSON.stringify(result.args) + '</div></div>';
			});

		}).catch(function (e) {
			console.log(e);
			App.setStatus("Error getting balance; see log.");
		});
	},
	sellToken: function() {
		//sell token
		let tokenName = document.getElementById('inputNameSellToken').value;
		let amount = document.getElementById('inputAmountSellToken').value;
		let price = document.getElementById('inputPriceSellToken').value;

		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			console.log(tokenName + price + amount);
			return exchangeInstance.sellToken(tokenName, price, amount, {from: account, gas: 4000000});
		}).then(function(txResult) {
			App.refreshBalanceExchange();
			App.updateOrderBooks();
		}).catch(function(e) {
			console.log(e);
			App.setStatus('Error: see log');
		});

	},
	buyToken: function() {
		//buy token
		let tokenName = document.getElementById('inputNameBuyToken').value;
		let amount = document.getElementById('inputAmountBuyToken').value;
		let price = document.getElementById('inputPriceBuyToken').value;

		let exchangeInstance;
		ExchangeContract.deployed().then(function(instance) {
			exchangeInstance = instance;
			console.log(tokenName + price + amount);
			return exchangeInstance.buyToken(tokenName, price, amount, {from: account, gas: 4000000});
		}).then(function(txResult) {
			App.refreshBalanceExchange();
			App.updateOrderBooks();
		}).catch(function(e) {
			console.log(e);
			App.setStatus('Error: see log');
		});
	},

	/**
	 * TOKEN FUNCTIONS FROM HERE ON
	 */
	initManageToken: function() {
		console.log('watching..');
		App.updateTokenBalance();
		App.watchTokenEvents();
		App.printImportantInformation();
	},
	updateTokenBalance: function() {
		//update the token balance
		let tokenInstance;
		TokenContract.deployed().then(function(instance) {
			tokenInstance = instance;
			return tokenInstance.balanceOf(account, {from: account});
		}).then(function(value) {
			console.log('account token balance: ', value);
			let balance_element = document.getElementById("balanceTokenInToken");
			balance_element.innerHTML = value.toNumber();
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log.");
		})
	},
	watchTokenEvents: function() {
		//watch for token events
		let tokenInstance;
		TokenContract.deployed().then(function(instance) {
			tokenInstance = instance;
			// Watch for all events
			tokenInstance.allEvents({}, {fromBlock:0, toBlock:'latest'}).watch(function(error, result) {
				console.log('event received: ', result);
				let alertbox = document.createElement("div");
				alertbox.setAttribute("class", "alert alert-info alert-dismissible");
				let closeBtn = document.createElement("button");
				closeBtn.setAttribute("type", "button");
				closeBtn.setAttribute("class", "close");
				closeBtn.setAttribute("data-dismiss", "alert");
				closeBtn.innerHTML = "<span>&times;</span>";
				alertbox.appendChild(closeBtn);

				let eventTitle = document.createElement("div");
				eventTitle.innerHTML = '<strong>New Event: ' + result.event + '</strong>';
				alertbox.appendChild(eventTitle);

				let argsBox = document.createElement('testarea');
				argsBox.setAttribute("class", "form-control");
				argsBox.innerText = JSON.stringify(result.args);
				alertbox.appendChild(argsBox);
				document.getElementById("tokenEvents").appendChild(alertbox);

			});
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error getting balance; see log.");
		})
	},

	sendToken: function() {
		//send tokens

		let amount = parseInt(document.getElementById("inputAmountSendToken").value);
		let receiver = document.getElementById("inputBeneficiarySendToken").value;

		App.setStatus("Initiating transaction... (please wait)");

		let tokenInstance;
		return TokenContract.deployed().then(function(instance) {
			tokenInstance = instance;
			return tokenInstance.transfer(receiver, amount, {from: account});
		}).then(function() {
			App.setStatus("Transaction Complete");
			App.updateTokenBalance();
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error sending coin; see log.");
		})

	},

	allowanceToken: function() {
		//token allowance

		let amount = parseInt(document.getElementById('inputAmountAllowanceToken').value);
		let receiver = document.getElementById('inputBeneficiaryAllowanceToken').value;

		App.setStatus("Initiating transaction... ");

		let tokenInstance;
		return TokenContract.deployed().then(function(instance) {
			tokenInstance = instance;
			return tokenInstance.approve(receiver, amount, {from: account});
		}).then(function() {
			App.setStatus("Transaction Complete");
		}).catch(function(e) {
			console.log(e);
			App.setStatus("Error approving receiver; see log");
		})

	}
};

window.addEventListener('load', function() {
	// Checking if Web3 has been injected by the browser (Mist/MetaMask)
	if (typeof web3 !== 'undefined') {
		console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
	}

	App.start();
});
