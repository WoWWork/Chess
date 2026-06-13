const workerUrl = 'https://cdn.bootcdn.net/ajax/libs/stockfish.js/10.0.2/stockfish.js';

function askAI(workerUrl, situation, depth = '10') {
	if (currentPlayer !== PCColor || selected) return;

	let side = PCColor === "white" ? ' w' : ' b';
	// 透過 fetch 抓取腳本內容並包裝
	fetch(workerUrl)
	  .then(response => response.text())
	  .then(code => {
		// 將程式碼轉為 Blob 物件
		const blob = new Blob([code], { type: 'application/javascript' });
		const blobURL = URL.createObjectURL(blob);
			
		// 使用同源的 Blob URL 成功建立 Worker
		window.stockfish = new Worker(blobURL);
		console.log('Stockfish Worker 建立成功！', window.stockfish);
			
		// 測試：監聽引擎回傳的訊息
		window.stockfish.onmessage = (event) => {
		  console.log('引擎回應：', event.data);
		  analysisData(event.data);
		};
			
		// 測試：發送 uci 指令初始化
		window.stockfish.postMessage('uci');
			
		window.stockfish.postMessage('isready');

		// Tell the engine to clear its state for a new game
		window.stockfish.postMessage('ucinewgame');

		// Define a board position (This layout is the baseline starting board position)
		const startingFen = situation + side + ' KQkq - 0 1';
		window.stockfish.postMessage(`position fen ${startingFen}`);

		// 4. Start analysis (Search until 10 calculations deep)
		window.stockfish.postMessage('go depth ' + depth);

	  })
	  .catch(error => console.error('無法載入或建立 Stockfish Worker:', error));
	  
	currentPlayer = currentPlayer === "white" ? "black" : "white";
}
	
function boardToFen(boardArray) {
	return boardArray.map(row => {
	  let rowStr = '';
	  let emptyCount = 0;

	  for (const cell of row) {
		if (cell === null) {
		  emptyCount++; // 遇到空格，累加計數
		} else {
		if (emptyCount > 0) {
		  rowStr += emptyCount; // 放棋子前，先把前面的空格數填入
		  emptyCount = 0;
		}
		  rowStr += cell.nick; // 放入棋子的簡稱 (r, n, b, P, K...)
		}
      }
		
	  if (emptyCount > 0) {
		rowStr += emptyCount; // 如果結尾有空格，補上數字
      }
		
	  return rowStr;
	}).join('/'); // 用斜線把 8 個橫列串接起來
}

function analysisData(data) {
	const engineOutput = data;

	if (engineOutput.startsWith('bestmove')) {
		const parts = engineOutput.split(' ');
		const bestMove = parts[1]; // 陣列索引 1 就是步法
		
		uciToCoords(bestMove);
	}
}

function uciToCoords(moveStr) {
    // 透過字元編碼 (ASCII) 來計算：'a' 的編碼是 97
    const fileToCol = (char) => char.charCodeAt(0) - 97;
    
    // 棋盤第 8 列對應陣列索引 0，第 1 列對應索引 7
    const rankToRow = (char) => 8 - parseInt(char, 10);

    // 解析出發格與目的格
    const fromCol = fileToCol(moveStr[0]);
    const fromRow = rankToRow(moveStr[1]);
    const toCol = fileToCol(moveStr[2]);
    const toRow = rankToRow(moveStr[3]);

    // 如果有第 5 個字元（如 e7e8q），代表是兵的升變 (promotion)
    const promotion = moveStr[4] || null;
	
	moveHistory.push({
			from: {
				row: fromRow,
				col: fromCol
			},
			to: {
				row: toRow,
				col: toCol
			},

			movedPiece: {
				...board[fromRow][fromCol]
			},
			
			capturedPiece: board[toRow][toCol] ? { ...board[toRow][toCol] } : null, 
			
			enpassanting: false,  
			
			currentPlayer
		});
	from = {row:fromRow, col:fromCol};
	to = {row:toRow, col:toCol};
	
	enPassant(board[from.row][from.col], from, to);
	
    board[toRow][toCol] = board[fromRow][fromCol];
	board[fromRow][fromCol] = null;
	
	castling(board[toRow][toCol], from, to);
	
	if(promotion) {
		if(promotion === 'q' || promotion === 'Q') board[toRow][toCol].type = "queen";
		if(promotion === 'r' || promotion === 'R') board[toRow][toCol].type = "rook";
		if(promotion === 'n' || promotion === 'N') board[toRow][toCol].type = "knight";
		if(promotion === 'b' || promotion === 'B') board[toRow][toCol].type = "bishop";
		board[toRow][toCol].nick = promotion;
	}
}

renderBoard();