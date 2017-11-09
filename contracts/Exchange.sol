pragma solidity ^0.4.18;

import './owned.sol';
import './FixedSupplyToken.sol';

contract Exchange is owned {

    ///////////////////////
    // GENERAL STRUCTURE //
    ///////////////////////

    struct Offer {

        // An offer made by a person.
        uint amount;
        address who;

    }

    struct OrderBook {

        // This is a linked list, ordered by price. Each orderbook points
        // to the higher and lower items in the list

        uint higherPrice;
        uint lowerPrice;

        // The offers for this orderbook's price
        mapping (uint => Offer) offers;

        uint offers_key;
        uint offers_length;

    }

    struct Token {

        address tokenContract;

        string symbolName;

        // Key is the token price
        mapping (uint => OrderBook) buyBook;
        mapping (uint => OrderBook) sellBook;

        // highest buy price
        uint curBuyPrice;
        // Lowest buy price.
        uint lowestBuyPrice;
        // Number of different buy prices
        uint amountBuyPrices;

        // lowest sell price
        uint curSellPrice;
        // Highest sell price
        uint highestSellPrice;
        // Number of different sell prices
        uint amountSellPrices;

    }

    // supporting a max of 255 tokens
    // key is the token id
    mapping (uint8 => Token) tokens;
    // used to keep track of the number of registered tokens
    uint8 symbolNameIndex;

    //////////////
    // BALANCES //
    //////////////
    mapping (address => mapping (uint8 => uint)) tokenBalancesForAddresses;

    mapping (address => uint) balanceEthForAddress;

    /////////////
    // EVENTS  //
    /////////////

    // Events for deposit/withdrawal
    event DepositForTokenReceived(address indexed _from, uint indexed _symbolIndex, uint _amount, uint _timestamp);
    event WithdrawalToken(address indexed _to, uint indexed _symbolIndex, uint _amount, uint _timestamp);
    event DepositForEthReceived(address indexed _from, uint _amount, uint _timestamp);
    event WithdrawalEth(address indexed _to, uint _amount, uint _timestamp);

    // Events for orders
    event LimitSellOrderCreated(uint indexed _symbolIndex, address indexed _who, uint _amountTokens, uint _priceInWei, uint _orderKey);
    event SellOrderFulfilled(uint indexed _symbolIndex, uint _amount, uint _priceInWei, uint _orderKey);
    event SellOrderCancelled(uint indexed _symbolIndex, uint _priceInWei, uint _orderKey);
    event LimitBuyOrderCreated(uint indexed _symbolIndex, address indexed _who, uint _amountTokens, uint _priceInWei, uint _orderKey);
    event BuyOrderFulfilled(uint indexed _symbolIndex, uint _amount, uint _priceInWei, uint _orderKey);
    event BuyOrderCancelled(uint indexed _symbolIndex, uint _priceInWei, uint _orderKey);

    // Events for management
    event TokenAddedToSystem(uint _symbolIndex, string _token, uint _timestamp);

    // Debug Event
    event Debug(string msg, uint variable);

    ////////////////////////////////
    // DEPOSIT AND WITHDRAW ETHER //
    ////////////////////////////////

    function depositEther() public payable {
        // Need to prevent uint256 overflow (restarting number from 0)
        require(balanceEthForAddress[msg.sender] + msg.value >= balanceEthForAddress[msg.sender]);
        balanceEthForAddress[msg.sender] += msg.value;

        DepositForEthReceived(msg.sender, msg.value, now);
    }

    function withdrawEther(uint amountInWei) public {
        // Check that the user has sufficient balance
        require(balanceEthForAddress[msg.sender] - msg.value >= 0);
        // Check that the uint256 doesn't underflow (restart from really big number)
        require(balanceEthForAddress[msg.sender] - msg.value <= balanceEthForAddress[msg.sender]);
        balanceEthForAddress[msg.sender] -= amountInWei;
        msg.sender.transfer(amountInWei);

        WithdrawalEth(msg.sender, amountInWei, now);
    }

    function getEthBalanceInWei() public constant returns (uint) {
        return balanceEthForAddress[msg.sender];
    }

    //////////////////////
    // TOKEN MANAGEMENT //
    //////////////////////

    function addToken(string symbolName, address erc20TokenAddress) public onlyowner {
        require (!hasToken(symbolName));
        symbolNameIndex++;
        tokens[symbolNameIndex].symbolName = symbolName;
        tokens[symbolNameIndex].tokenContract = erc20TokenAddress;

        TokenAddedToSystem(symbolNameIndex, symbolName, now);
    }

    function hasToken(string symbolName) public constant returns (bool) {
        uint8 index = getSymbolIndex(symbolName);
        if (index == 0) {
            return false;
        }
        return true;
    }

    function getSymbolIndex(string symbolName) internal returns (uint8) {
        for (uint8 i=1; i<=symbolNameIndex; i++) {
            if (stringsEqual(tokens[i].symbolName, symbolName)) {
                return i;
            }
        }
        return 0;
    }

    function getSymbolIndexOrThrow(string symbolName) returns (uint8) {
        uint8 index = getSymbolIndex(symbolName);
        require (index > 0);
        return index;
    }

    ////////////////////////////////
    // STRING COMPARISON FUNCTION //
    ////////////////////////////////
    function stringsEqual(string storage _a, string memory _b) internal returns (bool) {
        bytes storage a = bytes(_a);
        bytes memory b = bytes(_b);
        if (a.length != b.length)
        return false;
        // @todo unroll this loop
        for (uint i=0; i<a.length; i++)
        if (a[i] != b[i])
        return false;
        return true;
    }


    /////////////////////////////////
    // DEPOSIT AND WITHDRAWL TOKEN //
    /////////////////////////////////

    function depositToken(string symbolName, uint amount) public {

        // Make sure that the amount is actually an amount
        assert(amount > 0);

        uint8 symbolIndex = getSymbolIndexOrThrow(symbolName);

        // Check that the symbol token contract actually exists
        require(tokens[symbolIndex].tokenContract != address(0));

        // Get the token contract instance
        ERC20Interface token = ERC20Interface(tokens[symbolIndex].tokenContract);

        // Make sure the transaction with the token contract goes through
        require(token.transferFrom(msg.sender, address(this), amount) == true);

        // Make sure that we don't overflow the uint256
        require(tokenBalancesForAddresses[msg.sender][symbolIndex] + amount >= tokenBalancesForAddresses[msg.sender][symbolIndex]);
        // Update the token balance
        tokenBalancesForAddresses[msg.sender][symbolIndex] += amount;

        DepositForTokenReceived(msg.sender, symbolNameIndex, amount, now);

    }

    function withdrawToken(string symbolName, uint amount) public {

        uint8 symbolIndex = getSymbolIndex(symbolName);

        // Check that the symbol token contract actually exists
        require(tokens[symbolIndex].tokenContract != address(0));

        // Check that the user has sufficient token balance
        require(tokenBalancesForAddresses[msg.sender][symbolIndex] >= amount);
        // Check that the uint256 doesn't underflow and become a giant number (feel like this isn't necessary)
        require(tokenBalancesForAddresses[msg.sender][symbolIndex] - amount <= tokenBalancesForAddresses[msg.sender][symbolIndex]);

        // Get the token contract instance
        ERC20Interface token = ERC20Interface(tokens[symbolIndex].tokenContract);

        tokenBalancesForAddresses[msg.sender][symbolIndex] -= amount;

        // Make sure that you get the finished transfer
        // Note that this is sending the tokens from the contract's address.
        require(token.transfer(msg.sender, amount) == true);

        WithdrawalToken(msg.sender, symbolNameIndex, amount, now);

    }

    function getBalance(string symbolName) public constant returns (uint) {

        uint8 symbolIndex = getSymbolIndexOrThrow(symbolName);

        return tokenBalancesForAddresses[msg.sender][symbolIndex];

    }

    /////////////////////////////
    // ORDER BOOK - BID ORDERS //
    /////////////////////////////

    function getBuyOrderBook(string symbolName) public constant returns (uint[], uint[]) {

        uint8 tokenNameIndex = getSymbolIndexOrThrow(symbolName);
        // We initialize static sized arrays for the prices and volumes, with size amountBuyPrices which
        // we keep track of
        uint[] memory arrPricesBuy = new uint[](tokens[tokenNameIndex].amountBuyPrices);
        uint[] memory arrVolumesBuy = new uint[](tokens[tokenNameIndex].amountBuyPrices);

        uint whilePrice = tokens[tokenNameIndex].lowestBuyPrice;

        uint counter = 0;
        // Check that there is at least one orderBook available at any price
        if (tokens[tokenNameIndex].curBuyPrice > 0) {

//            if (whilePrice == 0) {
//
//                // Find the lowest price
//                uint counter1 = 0;
//                while (counter1 <= tokens[tokenNameIndex].curBuyPrice) {
//                    if (tokens[tokenNameIndex].buyBook[counter1].offers_key > 0) {
//                        whilePrice = counter1;
//                    }
//                    counter1 += 1000000000000000;
//                }
//
//            }

            while (whilePrice <= tokens[tokenNameIndex].curBuyPrice) {

                // Add the price to our prices array
                arrPricesBuy[counter] = whilePrice;

                uint volumeAtPrice = 0;
                uint offers_key = 0;

                offers_key = tokens[tokenNameIndex].buyBook[whilePrice].offers_key;
                while (offers_key <= tokens[tokenNameIndex].buyBook[whilePrice].offers_length) {
                    // Get the amount available from the specific offer
                    volumeAtPrice += tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].amount;
                    offers_key++;
                }

                arrVolumesBuy[counter] = volumeAtPrice;

                // Set the next whilePrice
                // Because the logic in addBuyOffer() is to set the highest buy offer's higherprice to it's own price
                if (whilePrice == tokens[tokenNameIndex].curBuyPrice || whilePrice == 0) {
                    break;
                } else {
                    whilePrice = tokens[tokenNameIndex].buyBook[whilePrice].higherPrice;
                }
                counter++;

            }
        }

        return (arrPricesBuy, arrVolumesBuy);

    }

    /////////////////////////////
    // ORDER BOOK - ASK ORDERS //
    /////////////////////////////

    function getSellOrderBook(string symbolName) public constant returns (uint[], uint[]) {

//        Debug("Offers length", tokens[tokenNameIndex].sellBook[whilePrice].offers_length);
//        Debug("Offers key", tokens[tokenNameIndex].sellBook[whilePrice].offers_key);

        uint8 tokenNameIndex = getSymbolIndexOrThrow(symbolName);
        // Initialize the static arrays
        uint[] memory arrPricesSell = new uint[](tokens[tokenNameIndex].amountSellPrices);
        uint[] memory arrVolumesSell = new uint[](tokens[tokenNameIndex].amountSellPrices);

        uint whilePrice = tokens[tokenNameIndex].highestSellPrice;
        uint counter = 0;

        // Check that there is at least one orderBook available for this token
        if (tokens[tokenNameIndex].curSellPrice > 0) {
            while(whilePrice >= tokens[tokenNameIndex].curSellPrice) {

                // Add the price to our prices array
                arrPricesSell[counter] = whilePrice;

                uint volumeAtPrice = 0;
                uint offers_key;

//                Debug("Offers length", tokens[tokenNameIndex].sellBook[whilePrice].offers_length);
//                Debug("Offers key", tokens[tokenNameIndex].sellBook[whilePrice].offers_key);

                offers_key = tokens[tokenNameIndex].sellBook[whilePrice].offers_key;
                while(offers_key <= tokens[tokenNameIndex].sellBook[whilePrice].offers_length) {
                    // Get the amount available from the specific order
                    volumeAtPrice += tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount;
                    offers_key++;
                }

                arrVolumesSell[counter] = volumeAtPrice;

                // Set the next whilePrice
                // Because the logic in addSellOffer() is to set the highest sell offer as 0
                if (whilePrice == 0) {
                    break;
                } else {
                    whilePrice = tokens[tokenNameIndex].sellBook[whilePrice].lowerPrice;
                }
                counter++;

            }
        }

        return (arrPricesSell, arrVolumesSell);

    }

    ///////////////////////////
    // NEW ORDER - BID ORDER //
    ///////////////////////////

    function buyToken(string symbolName, uint priceInWei, uint amount) public {

        uint8 tokenNameIndex = getSymbolIndexOrThrow(symbolName);
        uint total_amount_ether_necessary = 0;
        uint total_amount_ether_available = 0;

        // Check if we have enough ether to make this transaction
        total_amount_ether_necessary = amount*priceInWei;

        // Overflow check
        require(total_amount_ether_necessary >= amount);
        require(total_amount_ether_necessary >= priceInWei);
        require(balanceEthForAddress[msg.sender] >= total_amount_ether_necessary);
        require(balanceEthForAddress[msg.sender] - total_amount_ether_necessary >= 0);

        // First deduct the amount of ether from our balance
        balanceEthForAddress[msg.sender] -= total_amount_ether_necessary;

        // If there hasn't been any sell offers or the current sell price is larger than the buyer wants to pay
        if (tokens[tokenNameIndex].amountSellPrices == 0 || tokens[tokenNameIndex].curSellPrice > priceInWei) {

            // limit order: we don't have enough offers to fulfill the amount

            // add the order to the orderBook
            addBuyOffer(tokenNameIndex, priceInWei, amount, msg.sender);

            // and emit the event
            LimitBuyOrderCreated(tokenNameIndex, msg.sender, amount, priceInWei, tokens[tokenNameIndex].buyBook[priceInWei].offers_length);
        }

        else {

            // market order: current sell price is smaller or equal to buy price!

            // find the lowest sell price that is lower than the buy price

            // Start with the lowest sell price.
            total_amount_ether_available = 0;
            uint whilePrice = tokens[tokenNameIndex].curSellPrice;
            uint amountNecessary = amount;
            uint offers_key;

            // Cycle through all the prices, starting with the lowest one
            while (whilePrice <= priceInWei && amountNecessary > 0 && tokens[tokenNameIndex].curSellPrice != 0) {
                // The offers key is updated with the lowest available index of funds (since funds are sold in order for each price)
                offers_key = tokens[tokenNameIndex].sellBook[whilePrice].offers_key;
                // keep looping as long as there are more offers and we need more tokens
                while (offers_key <= tokens[tokenNameIndex].sellBook[whilePrice].offers_length && amountNecessary > 0) {
                    uint volumeAtPriceFromAddress = tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount;

                    // We have two possibilities here:
                    // 1) We buy everything this offer has to offer and need to move on to the next order
                    // 2) We buy some of the tokens this offer has and fulfill our order

                    // We can buy everything from this order
                    if (volumeAtPriceFromAddress <= amountNecessary) {
                        total_amount_ether_available = volumeAtPriceFromAddress * whilePrice;

                        // Make sure the person we're buying from actually has sufficient tokens
                        require(tokenBalancesForAddresses[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who][tokenNameIndex] >= volumeAtPriceFromAddress);

                        // Make sure that the buyer can actually purchase these tokens
                        require(balanceEthForAddress[msg.sender] - total_amount_ether_available >= 0);
                        // overflow check
                        require(balanceEthForAddress[msg.sender] - total_amount_ether_available <= balanceEthForAddress[msg.sender]);
                        // overflow check - that the seller can hold the ether we are giving him
                        require(balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who] + total_amount_ether_available >= balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who]);

                        // Transfer the tokens to the buyer no need since when we list the sale we already deduct it
//                        tokenBalancesForAddresses[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who][tokenNameIndex] -= (volumeAtPriceFromAddress + 1);
                        // Take the ether away from the buyer
                        balanceEthForAddress[msg.sender] -= total_amount_ether_available;
                        // Send the ether to the seller
                        balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who] += total_amount_ether_available;
                        // Transfer the tokens to the buyer
                        tokenBalancesForAddresses[msg.sender][tokenNameIndex] += volumeAtPriceFromAddress;

                        // Clear the sell book volume
                        tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount = 0;
                        // Update the offer key index
                        tokens[tokenNameIndex].sellBook[whilePrice].offers_key++;

                        amountNecessary -= volumeAtPriceFromAddress;

                        if (amountNecessary == 0) {
                            BuyOrderFulfilled(tokenNameIndex, volumeAtPriceFromAddress, whilePrice, offers_key);
                        }

                    } else {

                        // If this offer has more tokens than we want, we can just fulfill our order here
                        require(tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount > amountNecessary);
                        // since amountNecessary is all we need now
                        total_amount_ether_necessary = amountNecessary * whilePrice;

                        // overflow check - the seller has the required tokens
                        require(tokenBalancesForAddresses[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who][tokenNameIndex] >= amountNecessary);
                        // Subtract the tokens from the seller
//                        tokenBalancesForAddresses[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who][tokenNameIndex] -= amountNecessary;

                        // overflow check - check that after we add the ether to the seller they still have positive balance
                        require(balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who] + total_amount_ether_necessary >= balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who]);
                        // overflow check - check that the buyer can hold the new tokens
                        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] + amountNecessary >= tokenBalancesForAddresses[msg.sender][tokenNameIndex]);

                        // reduce the number of tokens available in this listing
                        tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount -= amountNecessary;
                        // Transfer the tokens to us
                        tokenBalancesForAddresses[msg.sender][tokenNameIndex] += amountNecessary;
                        // Take the ether from us
                        balanceEthForAddress[msg.sender] -= total_amount_ether_necessary;
                        // Transfer the ether to him
                        balanceEthForAddress[tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].who] += total_amount_ether_necessary;

                        BuyOrderFulfilled(tokenNameIndex, amountNecessary, whilePrice, offers_key);

                        // We have fulfilled our order
                        amountNecessary = 0;

                    }

                    // If this was the last offer for that price, we have to move the curSellPrice higher.
                    // We also have one less sell offer
                    if (offers_key == tokens[tokenNameIndex].sellBook[whilePrice].offers_length &&
                        tokens[tokenNameIndex].sellBook[whilePrice].offers[offers_key].amount == 0) {

                        // One less sell price
                        tokens[tokenNameIndex].amountSellPrices--;
                        // Move on to the next sell price
                        if (whilePrice == tokens[tokenNameIndex].sellBook[whilePrice].higherPrice || whilePrice == 0 || tokens[tokenNameIndex].amountSellPrices == 0) {
                            // Reached the last price.
                            tokens[tokenNameIndex].curSellPrice = 0;
                            tokens[tokenNameIndex].highestSellPrice = 0;
                        } else {
                            tokens[tokenNameIndex].curSellPrice = tokens[tokenNameIndex].sellBook[whilePrice].higherPrice;
                            // Set the next most expensive sell order's lower price to the current sell price
                            tokens[tokenNameIndex].sellBook[tokens[tokenNameIndex].buyBook[whilePrice].higherPrice].lowerPrice = tokens[tokenNameIndex].curSellPrice;

                        }

                    }
                    offers_key++;

                }
                // Update the whilePrice to the next lowest sell price.
                whilePrice = tokens[tokenNameIndex].curSellPrice;

            }

            // If we still need to buy more, we make a listing
            if (amountNecessary > 0) {
                // Because amountNecessary will be subtracted when we call buyToken
                balanceEthForAddress[msg.sender] += amountNecessary;
                buyToken(symbolName, priceInWei, amountNecessary);
            }

        }

    }

    function addBuyOffer(uint8 tokenIndex, uint priceInWei, uint amount, address who) internal {

        // because the offers are ordered in ascending order
        tokens[tokenIndex].buyBook[priceInWei].offers_length++;
        // Actually create the offer in the offer book
        tokens[tokenIndex].buyBook[priceInWei].offers[tokens[tokenIndex].buyBook[priceInWei].offers_length] = Offer(amount, who);

        // If this is the first offer to be added
        if (tokens[tokenIndex].buyBook[priceInWei].offers[tokens[tokenIndex].buyBook[priceInWei].offers_length-1].amount == 0 && tokens[tokenIndex].buyBook[priceInWei].offers_length > 1) {
            if (tokens[tokenIndex].lowestBuyPrice > priceInWei || tokens[tokenIndex].lowestBuyPrice == 0) {
                tokens[tokenIndex].lowestBuyPrice = priceInWei;
            }
//            if (tokens[tokenIndex].lowestBuyPrice == 0 && tokens[tokenIndex].amountBuyPrices == 0) {
//                tokens[tokenIndex].lowestBuyPrice = priceInWei;
//            }
            if (tokens[tokenIndex].curBuyPrice < priceInWei || tokens[tokenIndex].curSellPrice == 0) {
                tokens[tokenIndex].curBuyPrice = priceInWei;
            }
            tokens[tokenIndex].amountBuyPrices++;
        }

        // Taking care of our linked list, and we only have to do something if this is the first offer at it's price point
        // If it wasn't, then this was already taken care of last time.
        if (tokens[tokenIndex].buyBook[priceInWei].offers_length == 1) {
            // One more buy price available
            tokens[tokenIndex].amountBuyPrices++;

            // lowerPrice and higherPrice have to be set
            uint curBuyPrice = tokens[tokenIndex].curBuyPrice;

            uint lowestBuyPrice = tokens[tokenIndex].lowestBuyPrice;

            // If offer price is lower than the current lowest buy offer
            if (lowestBuyPrice == 0 || lowestBuyPrice > priceInWei) {
                if (curBuyPrice == 0) {
                    // There is no buy orders yet, and we insert the first one.
                    tokens[tokenIndex].curBuyPrice = priceInWei;
                    tokens[tokenIndex].buyBook[priceInWei].higherPrice = priceInWei;
                    tokens[tokenIndex].buyBook[priceInWei].lowerPrice = 0;
                } else {
                    // If this order is the cheapest buy order
                    tokens[tokenIndex].buyBook[lowestBuyPrice].lowerPrice = priceInWei;
                    tokens[tokenIndex].buyBook[priceInWei].higherPrice = lowestBuyPrice;
                    tokens[tokenIndex].buyBook[priceInWei].lowerPrice = 0;
                }
                tokens[tokenIndex].lowestBuyPrice = priceInWei;
            }

            // If offer price is bigger than the current largest buy offer
            else if (curBuyPrice < priceInWei) {
                // The offer to buy is the highest one, and we don't need to find the right spot
                tokens[tokenIndex].buyBook[curBuyPrice].higherPrice = priceInWei;
                tokens[tokenIndex].buyBook[priceInWei].higherPrice = priceInWei;
                tokens[tokenIndex].buyBook[priceInWei].lowerPrice = curBuyPrice;
                tokens[tokenIndex].curBuyPrice = priceInWei;
            }

            // If the offer price is somewhere in the middle
            else {

                uint buyPrice = tokens[tokenIndex].curBuyPrice;
                bool found = false;
                while (buyPrice > 0 && !found) {
                    // Since we are going from highest buy price to the lowest, our price needs to be above one price's
                    // higherPrice and lower than the last cycle's lowerPrice (set at the last line)
                    if (buyPrice < priceInWei && tokens[tokenIndex].buyBook[buyPrice].higherPrice > priceInWei) {
                        // set the new order book entry higher/lowerPrice first
                        // This is because the current offer price is between the found price's lower and higher price.
                        tokens[tokenIndex].buyBook[priceInWei].lowerPrice = buyPrice;
                        tokens[tokenIndex].buyBook[priceInWei].higherPrice = tokens[tokenIndex].buyBook[buyPrice].higherPrice;

                        // Set the higherPrice'd order-book entries lower price to the current price
                        tokens[tokenIndex].buyBook[tokens[tokenIndex].buyBook[buyPrice].higherPrice].lowerPrice = priceInWei;
                        // set the lowerPrice'd order-book entries higherPrice to the current price
                        tokens[tokenIndex].buyBook[buyPrice].higherPrice = priceInWei;

                        // Tell the loop to exit
                        found = true;
                    }
                    // Set the next iteration's buy price to the lower price of the current buyBook
                    buyPrice = tokens[tokenIndex].buyBook[buyPrice].lowerPrice;
                }

            }

        }

    }

    ///////////////////////////
    // NEW ORDER - ASK ORDER //
    ///////////////////////////

    function sellToken(string symbolName, uint priceInWei, uint amount) {

        uint8 tokenNameIndex = getSymbolIndexOrThrow(symbolName);
        uint total_amount_ether_necessary = 0;
        uint total_amount_ether_available = 0;

        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] - amount <= tokenBalancesForAddresses[msg.sender][tokenNameIndex]);
        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] - amount >= 0);


        // Only if we don't need to make a listing
        tokenBalancesForAddresses[msg.sender][tokenNameIndex] -= amount;

        // If there hasn't been any buy offers or the current buy offer is less than the sell price offered.
        if (tokens[tokenNameIndex].amountBuyPrices == 0 || tokens[tokenNameIndex].curBuyPrice < priceInWei) {

            // Add the order to the orderbook
            addSellOrder(tokenNameIndex, priceInWei, amount, msg.sender);

            // and emit the event offers length gets updated in addSellOrder()
            LimitSellOrderCreated(tokenNameIndex, msg.sender, amount, priceInWei, tokens[tokenNameIndex].sellBook[priceInWei].offers_length);

        } else {

            // Actually subtract token balance

            // market order: selling price is less than the buy price!

            // 1st: find the "highest buy price" that is higher than the sell amount eg [buy: 60@500] [buy: 50@450] offer: [sell: 500@400]
            // 2nd: sell all the volume for 500
            // 3rd: well all the volume for 450
            // 4th: create the sell token offer for 390 tokens at 400
            // 5th: add ether to seller, add tokens to buyer

            uint whilePrice = tokens[tokenNameIndex].curBuyPrice;
            uint amountNecessary = amount;
            uint offers_key;
            while (whilePrice >= priceInWei && amountNecessary > 0) {//we start with the highest buy price.
                offers_key = tokens[tokenNameIndex].buyBook[whilePrice].offers_key;
                while (offers_key <= tokens[tokenNameIndex].buyBook[whilePrice].offers_length && amountNecessary > 0) {//and the first order (FIFO)
                    uint volumeAtPriceFromAddress = tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].amount;


                    //Two choices from here:
                    //1) one person offers not enough volume to fulfill the market order - we use it up completely and move on to the next person who offers the symbolName
                    //2) else: we make use of parts of what a person is offering - lower his amount, fulfill out order.
                    if (volumeAtPriceFromAddress <= amountNecessary) {
                        total_amount_ether_available = volumeAtPriceFromAddress * whilePrice;


                        //overflow check
                        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] >= volumeAtPriceFromAddress);
                        //actually subtract the amount of tokens to change it then
//                        tokenBalancesForAddresses[msg.sender][tokenNameIndex] -= volumeAtPriceFromAddress;

                        //overflow check
                        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] - volumeAtPriceFromAddress >= 0);
                        require(tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex] + volumeAtPriceFromAddress >= tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex]);
                        require(balanceEthForAddress[msg.sender] + total_amount_ether_available >= balanceEthForAddress[msg.sender]);

                        //this guy offers less or equal the volume that we ask for, so we use it up completely.
                        tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex] += volumeAtPriceFromAddress;
                        tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].amount = 0;
                        balanceEthForAddress[msg.sender] += total_amount_ether_available;
                        tokens[tokenNameIndex].buyBook[whilePrice].offers_key++;

                        amountNecessary -= volumeAtPriceFromAddress;

                        if (amountNecessary == 0) {
                            SellOrderFulfilled(tokenNameIndex, volumeAtPriceFromAddress, whilePrice, offers_key);
                        }

                    } else {
                        require(volumeAtPriceFromAddress - amountNecessary > 0);
                        //just for sanity
                        total_amount_ether_necessary = amountNecessary * whilePrice;
                        //we take the rest of the outstanding amount

                        //overflow check
                        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] >= amountNecessary);
                        //actually subtract the amount of tokens to change it then
//                        tokenBalancesForAddresses[msg.sender][tokenNameIndex] -= amountNecessary;

                        //overflow check
                        require(tokenBalancesForAddresses[msg.sender][tokenNameIndex] >= amountNecessary);
                        require(balanceEthForAddress[msg.sender] + total_amount_ether_necessary >= balanceEthForAddress[msg.sender]);
                        require(tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex] + amountNecessary >= tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex]);

                        //this guy offers more than we ask for. We reduce his stack, add the eth to us and the symbolName to him.
                        tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].amount -= amountNecessary;
                        balanceEthForAddress[msg.sender] += total_amount_ether_necessary;
                        tokenBalancesForAddresses[tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].who][tokenNameIndex] += amountNecessary;

                        SellOrderFulfilled(tokenNameIndex, amountNecessary, whilePrice, offers_key);

                        amountNecessary = 0;
                        //we have fulfilled our order
                    }

                    //if it was the last offer for that price, we have to set the curBuyPrice now lower. Additionally we have one offer less...
                    if (offers_key == tokens[tokenNameIndex].buyBook[whilePrice].offers_length &&
                        tokens[tokenNameIndex].buyBook[whilePrice].offers[offers_key].amount == 0) {

                        tokens[tokenNameIndex].amountBuyPrices--;
                        //we have one price offer less here...
                        //next whilePrice
                        if (tokens[tokenNameIndex].buyBook[whilePrice].lowerPrice == 0 && tokens[tokenNameIndex].amountBuyPrices == 0) {
                            tokens[tokenNameIndex].curBuyPrice = 0;
                            tokens[tokenNameIndex].lowestBuyPrice = 0;
                            //we have reached the last price
                        } else {
                            // Haven't yet reached the last price
                            tokens[tokenNameIndex].curBuyPrice = tokens[tokenNameIndex].buyBook[whilePrice].lowerPrice;
                            tokens[tokenNameIndex].buyBook[tokens[tokenNameIndex].sellBook[whilePrice].lowerPrice].higherPrice = tokens[tokenNameIndex].curBuyPrice;
                        }
                    }
                    offers_key++;
                }

                //we set the curSellPrice again, since when the volume is used up for a lowest price the curSellPrice is set there...
                whilePrice = tokens[tokenNameIndex].curBuyPrice;
            }

            if (amountNecessary > 0) {
                // We do this because amountNecessary will be subtracted from the token Balance if we run sellToken
                // again, since it is done at the beginning everytime.
                tokenBalancesForAddresses[msg.sender][tokenNameIndex] += amountNecessary;
                sellToken(symbolName, priceInWei, amountNecessary);
                //add a limit order, we couldn't fulfill all the orders!
            }

        }

    }

    function addSellOrder(uint8 tokenIndex, uint priceInWei, uint amount, address who) internal {

        // because the offers are ordered in ascending order
        tokens[tokenIndex].sellBook[priceInWei].offers_length++;
        // Actually create the offer in the offer book
        tokens[tokenIndex].sellBook[priceInWei].offers[tokens[tokenIndex].sellBook[priceInWei].offers_length] = Offer(amount, who);

        // If we're adding an offer to a price that we previously sold out of
        if (tokens[tokenIndex].sellBook[priceInWei].offers[tokens[tokenIndex].sellBook[priceInWei].offers_length-1].amount == 0 && tokens[tokenIndex].sellBook[priceInWei].offers_length > 1) {
            if (tokens[tokenIndex].highestSellPrice < priceInWei) {
                tokens[tokenIndex].highestSellPrice = priceInWei;
            }
            if (tokens[tokenIndex].curSellPrice > priceInWei || tokens[tokenIndex].curSellPrice == 0) {
                tokens[tokenIndex].curSellPrice = priceInWei;
            }
            tokens[tokenIndex].amountSellPrices++;
        }


        // Taking care of our linked list, and we have to do this only if it is the first offer to come in at
        // this price, or else this would've been done already.
        if (tokens[tokenIndex].sellBook[priceInWei].offers_length == 1) {
            // One more sell price available
            tokens[tokenIndex].amountSellPrices++;

            // Get the current lowest sell price
            uint curSellPrice = tokens[tokenIndex].curSellPrice;
            // Get the highest sell price
            uint highestSellPrice = tokens[tokenIndex].highestSellPrice;

            // If the offer's sell price is higher than the current highest sell price
            if (highestSellPrice == 0 || highestSellPrice < priceInWei) {
                if (curSellPrice == 0) {
                    // There are no sell orders yet, and we have to add the first one
                    tokens[tokenIndex].curSellPrice = priceInWei;
                    tokens[tokenIndex].sellBook[priceInWei].higherPrice = 0;
                    tokens[tokenIndex].sellBook[priceInWei].lowerPrice = 0;
                } else {
                    // If this sell order is the most expensive sell order
                    tokens[tokenIndex].sellBook[highestSellPrice].higherPrice = priceInWei;
                    tokens[tokenIndex].sellBook[priceInWei].lowerPrice = highestSellPrice;
                    tokens[tokenIndex].sellBook[priceInWei].higherPrice = 0;
                }
                // This offerBook is now the highest sell price.
                tokens[tokenIndex].highestSellPrice = priceInWei;
            }

            // If the offer price is lower than the current lowest sell price
            else if (curSellPrice > priceInWei) {
                // The offer to sell is the cheapest one, and we don't need to find the right spot
                tokens[tokenIndex].sellBook[curSellPrice].lowerPrice = priceInWei;
                tokens[tokenIndex].sellBook[priceInWei].higherPrice = curSellPrice;
                // Just set it to itself
                tokens[tokenIndex].sellBook[priceInWei].lowerPrice = 0;
                tokens[tokenIndex].curSellPrice = priceInWei;
            }

            // If the offer price is somewhere in the middle
            else {

                uint sellPrice = tokens[tokenIndex].curSellPrice;
                bool found = false;
                while (sellPrice > 0 && !found) {
                    // Since we are going from lowest sell price to the highest, our sellPrice needs
                    // to be higher than the sellBook's lower price and lower than the current sellBook's higher price
                    if (priceInWei > sellPrice && tokens[tokenIndex].sellBook[sellPrice].higherPrice > priceInWei) {
                        // Set the new order book entry higher/lower price
                        tokens[tokenIndex].sellBook[priceInWei].lowerPrice = sellPrice;
                        tokens[tokenIndex].sellBook[priceInWei].higherPrice = tokens[tokenIndex].sellBook[sellPrice].higherPrice;

                        // Set the higherPriced order-book's lower price to the current price
                        tokens[tokenIndex].sellBook[tokens[tokenIndex].sellBook[sellPrice].higherPrice].lowerPrice = priceInWei;
                        // Set the lower priced order-book's higher price to the current price
                        tokens[tokenIndex].sellBook[sellPrice].higherPrice = priceInWei;

                        // Tell the loop to exit
                        found = true;
                    }

                    // Set the next iteration's sell price ot the higher price of the current
                    sellPrice = tokens[tokenIndex].sellBook[sellPrice].higherPrice;
                }

            }

        }

    }

    //////////////////////////////
    // CANCEL LIMIT ORDER LOGIC //
    //////////////////////////////

    function cancelOrder(string symbolName, bool isSellOrder, uint priceInWei, uint offerKey) {

        uint8 symbolNameIndex = getSymbolIndexOrThrow(symbolName);

        if (isSellOrder) {

            // Make sure person who made the offer is the same person cancelling it
            require(tokens[symbolNameIndex].sellBook[priceInWei].offers[offerKey].who == msg.sender);

            uint tokensAmount = tokens[symbolNameIndex].sellBook[priceInWei].offers[offerKey].amount;
            // Check for overflow
            require(tokenBalancesForAddresses[msg.sender][symbolNameIndex] + tokensAmount >= tokenBalancesForAddresses[msg.sender][symbolNameIndex]);

            // Return the tokens to the user's balance
            tokenBalancesForAddresses[msg.sender][symbolNameIndex] += tokensAmount;
            // Set the offer to zero
            tokens[symbolNameIndex].sellBook[priceInWei].offers[offerKey].amount = 0;
            SellOrderCancelled(symbolNameIndex, priceInWei, offerKey);

        }

        else {

            require(tokens[symbolNameIndex].buyBook[priceInWei].offers[offerKey].who == msg.sender);

            uint etherToRefund = tokens[symbolNameIndex].buyBook[priceInWei].offers[offerKey].amount * priceInWei;
            require(balanceEthForAddress[msg.sender] + etherToRefund >= balanceEthForAddress[msg.sender]);

            // Return the balance
            balanceEthForAddress[msg.sender] += etherToRefund;
            tokens[symbolNameIndex].buyBook[priceInWei].offers[offerKey].amount = 0;
            BuyOrderCancelled(symbolNameIndex, priceInWei, offerKey);

        }

    }

}