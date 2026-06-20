
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const sidebarElement = document.getElementById("sidebar");

let currentPlayer = "white";
let enPassantTarget = null;
let selected = null;
let moved = {
    whiteKing: false,
    blackKing: false,
    whiteRookA: false,
    whiteRookH: false,
    blackRookA: false,
    blackRookH: false
};
let endgame = false;
let moveHistory = [];
let gameMode;

let PCColor;

const pieces = {
    white: {
        king: "♔",
        queen: "♕",
        rook: "♖",
        bishop: "♗",
        knight: "♘",
        pawn: "♙"
    },
    black: {
        king: "♚",
        queen: "♛",
        rook: "♜",
        bishop: "♝",
        knight: "♞",
        pawn: "♟"
    }
};

let board = [
    [
        {type:"rook",color:"black",nick:"r"},
        {type:"knight",color:"black",nick:"n"},
        {type:"bishop",color:"black",nick:"b"},
        {type:"queen",color:"black",nick:"q"},
        {type:"king",color:"black",nick:"k"},
        {type:"bishop",color:"black",nick:"b"},
        {type:"knight",color:"black",nick:"n"},
        {type:"rook",color:"black",nick:"r"}
    ],
    Array(8).fill().map(() => ({type:"pawn",color:"black",nick:"p"})),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill().map(() => ({type:"pawn",color:"white",nick:"P"})),
    [
        {type:"rook",color:"white",nick:"R"},
        {type:"knight",color:"white",nick:"N"},
        {type:"bishop",color:"white",nick:"B"},
        {type:"queen",color:"white",nick:"Q"},
        {type:"king",color:"white",nick:"K"},
        {type:"bishop",color:"white",nick:"B"},
        {type:"knight",color:"white",nick:"N"},
        {type:"rook",color:"white",nick:"R"}
    ]
];

function renderBoard() {
    boardElement.innerHTML = "";
	
	if(!gameMode && !PCColor) {
		StartTheGame();
	}
	
	askAI(workerUrl, boardToFen(board));
	
	for(let row=0; row<8; row++) {
        for(let col=0; col<8; col++) {
            const square = document.createElement("div");

            square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");

            if (selected && selected.row === row && selected.col === col) {
                square.classList.add("selected");
            }

            const piece = board[row][col];

            if(piece) {
                square.textContent = pieces[piece.color][piece.type];
            }

            square.addEventListener("click", () => handleClick(row,col));

            boardElement.appendChild(square);
        }
    }
}

function handleClick(row,col) {
	if(endgame) return;
	
    const piece = board[row][col];

    if(!selected) {
        if(piece && piece.color === currentPlayer) {
            selected = {row,col};    
        }
		//renderBoard();
        return;
    }

    const from = selected;
    const movingPiece = board[from.row][from.col];

    if(isValidMove(movingPiece, from, {row,col})) {

        const target = board[row][col];
		
		moveHistory.push({
			from: {
				row: from.row,
				col: from.col
			},
			to: {
				row: row,
				col: col
			},

			movedPiece: {
				...movingPiece
			},
			
			capturedPiece: board[row][col] ? { ...board[row][col] } : null, 
			
			enpassanting: false,  
			
			currentPlayer
		});
		
		if(!target || target.color !== currentPlayer) {
            board[row][col] = movingPiece;
            board[from.row][from.col] = null;

			enPassantTarget = null;

			if (movingPiece.type === "pawn" && Math.abs(row - from.row) === 2) {
				enPassantTarget = {
					row: (from.row + row) / 2,
					col: from.col,
					pawnRow: row,
					pawnCol: col
				};
			}
			
            currentPlayer = currentPlayer === "white" ? "black" : "white";
			
            if (isInCheck(currentPlayer)) {
				if (hasAnyValidMove()) {
					statusElement.textContent = (currentPlayer === "white" ? "Black" : "White") + " wins.";
					endgame = true;
				} else {
					statusElement.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + " is in check!";
				}
			} else {
				statusElement.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";
			}
        }
		
		enPassant(movingPiece, from, {row,col});
		castling(movingPiece, from, {row,col});
		promotePawn(row, col);
    }

    selected = null;
    //renderBoard();
}

function isValidMove(piece, from, to, ignoreCheck = false) {

    const dx = to.col - from.col;
    const dy = to.row - from.row;

    const target = board[to.row][to.col];

    if(target && target.color === piece.color) return false;

    switch(piece.type) {
        case "pawn":
            const dir = piece.color === "white" ? -1 : 1;

            if(dx === 0 && !target) {
                if(dy === dir) {
					return true;
				}
                if(dy === dir * 2 && ((piece.color === "white" && from.row === 6) || (piece.color === "black" && from.row === 1))) {
                    return isPathClear(from, to);
                }
            }
			
			// en passant
			if (Math.abs(dx) === 1 &&
				dy === dir &&
				!target &&
				enPassantTarget &&
				enPassantTarget.row === to.row &&
				enPassantTarget.col === to.col
			) {
				return true;
			}
			
            if(Math.abs(dx) === 1 && dy === dir && target) {
				return true;
            }

            return false;

        case "rook":
            if (dx === 0 || dy === 0) {
				if(isPathClear(from, to)) {
					if(piece.color === "white" && from.row === 7 && from.col === 0) moved.whiteRookA = true;
					if(piece.color === "white" && from.row === 7 && from.col === 7) moved.whiteRookH = true;
					if(piece.color === "black" && from.row === 0 && from.col === 0) moved.blackRookA = true;
					if(piece.color === "black" && from.row === 0 && from.col === 7) moved.blackRookH = true;
					return true; 
				}
			}
			return false;

        case "bishop":
            if (Math.abs(dx) === Math.abs(dy)) {
				return isPathClear(from, to);
			}
			return false;

        case "queen":
            if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
				return isPathClear(from, to);
			}
			return false;

        case "knight":
            return ((Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2));

        case "king":
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
				if(piece.color === "white") moved.whiteKing = true;
				else moved.whiteKing = true;
				return true;
			}

			// CASTLING
			if (piece.color === "white" && from.row === 7 && from.col === 4) {

				// king-side
				if (to.row === 7 && to.col === 6) {
					if (!moved.whiteKing &&
						!moved.whiteRookH &&
						!board[7][5] &&
						!board[7][6] &&
						!isSquareAttacked(7, 4, "black") &&
						!isSquareAttacked(7, 5, "black") &&
						!isSquareAttacked(7, 6, "black") && 
						board[7][7]
					) {
						moved.whiteKing = true;
						moved.whiteRookH = true;
						return true;
					}
				}

				// queen-side
				if (to.row === 7 && to.col === 2) {
					if (!moved.whiteKing &&
						!moved.whiteRookA &&
						!board[7][1] &&
						!board[7][2] &&
						!board[7][3] &&
						!isSquareAttacked(7, 4, "black") &&
						!isSquareAttacked(7, 3, "black") &&
						!isSquareAttacked(7, 2, "black") &&
						board[7][0]
					) {
						moved.whiteKing = true;
						moved.whiteRookA = true;
						return true;
					}
				}
			}

			if (piece.color === "black" && from.row === 0 && from.col === 4) {

				// king-side
				if (to.row === 0 && to.col === 6) {
					if (!moved.blackKing &&
						!moved.blackRookH &&
						!board[0][5] &&
						!board[0][6] &&
						!isSquareAttacked(0, 4, "white") &&
						!isSquareAttacked(0, 5, "white") &&
						!isSquareAttacked(0, 6, "white") &&
						board[0][7]
					) {
						moved.blackKing = true;
						moved.blackRookH = true;
						return true;
					}
				}

				// queen-side
				if (to.row === 0 && to.col === 2) {
					if (!moved.blackKing &&
						!moved.blackRookA &&
						!board[0][1] &&
						!board[0][2] &&
						!board[0][3] &&
						!isSquareAttacked(0, 4, "white") &&
						!isSquareAttacked(0, 3, "white") &&
						!isSquareAttacked(0, 2, "white") &&
						board[0][0]
					) {
						moved.blackKing = true;
						moved.blackRookA = true;
						return true;
					}
				}
			}
			return false;
    }
	
	return false;
}

function isPathClear(from, to) {
    const rowStep = Math.sign(to.row - from.row);
    const colStep = Math.sign(to.col - from.col);

    let row = from.row + rowStep;
    let col = from.col + colStep;

    while (row !== to.row || col !== to.col) {
        if (board[row][col] !== null) {
            return false;
        }

        row += rowStep;
        col += colStep;
    }

    return true;
}

function findKing(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === "king" && p.color === color) {
                return { row: r, col: c };
            }
        }
    }
    return null;
}

function isInCheck(color) {
    const king = findKing(color);
    const enemy = color === "white" ? "black" : "white";
	if(!king) return true;
    else return isSquareAttacked(king.row, king.col, enemy);
}

function hasAnyValidMove() {
    return (!findKing("white") || !findKing("black"));
}

function isSquareAttacked(row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

            const piece = board[r][c];

            if (!piece || piece.color !== byColor) {
                continue;
            }

            if (isValidMove(piece, { row: r, col: c }, { row, col })) {
                return true;
            }
        }
    }

    return false;
}

function undoMove() {
	if (endgame) endgame = false;
    if (moveHistory.length === 0) {
        alert("No moves to undo");
        return;
    }

    const move = moveHistory.pop();
	const dir = move.currentPlayer === "white" ? -1 : 1;
	
    board[move.from.row][move.from.col] = move.movedPiece;

    if(!move.enpassanting)board[move.to.row][move.to.col] = move.capturedPiece;
	else {
		enPassantTarget = {
					row: move.to.row,
					col: move.to.col,
					pawnRow: (move.from.row + move.to.row) / 2,
					pawnCol: move.from.col
				};
		board[move.to.row][move.to.col] = null;
		board[move.to.row - dir][move.to.col] = move.capturedPiece;
	}
	
    currentPlayer = move.currentPlayer;
	
	castling(move.movedPiece, move.to, move.from);
	
    statusElement.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";

    selected = null;

    //renderBoard();
}

function castling(piece, from, to) {
	// WHITE castling rook move
	if (piece.type === "king" && from.row === 7 && from.col === 4) {
		// king-side
		if (board[7][7] && board[7][7].type === "rook" && board[7][7].color === "white" && to.row === 7 && to.col === 6) {
			board[7][5] = board[7][7];
			board[7][7] = null;
		}

		// queen-side
		if (board[7][0] && board[7][0].type === "rook" && board[7][0].color === "white" && to.row === 7 && to.col === 2) {
			board[7][3] = board[7][0];
			board[7][0] = null;
		}
	}
	
	// undo WHITE castling rook move
	if (piece.type === "king" && from.row === 7 && from.col === 6) {
		// king-side
		if (to.row === 7 && to.col === 4) {
			board[7][7] = board[7][5];
			board[7][5] = null;
			moved.whiteKing = false;
			moved.whiteRookH = false;
		}
	}
	if (piece.type === "king" && from.row === 7 && from.col === 2) {
		// queen-side
		if (to.row === 7 && to.col === 4) {
			board[7][0] = board[7][3];
			board[7][3] = null;
			moved.whiteKing = false;
			moved.whiteRookA = false;
		}
	}
	
	// BLACK castling rook move
	if (piece.type === "king" && from.row === 0 && from.col === 4) {
		// king-side
		if (board[0][7] && board[0][7].type === "rook" && board[0][7].color === "black" && to.row === 0 && to.col === 6) {
			board[0][5] = board[0][7];
			board[0][7] = null;
		}

		// queen-side
		if (board[0][0] && board[0][0].type === "rook" && board[0][0].color === "black" && to.row === 0 && to.col === 2) {
			board[0][3] = board[0][0];
			board[0][0] = null;
		}
	}
	
	// undo BLACK castling rook move
	if (piece.type === "king" && from.row === 0 && from.col === 6) {
		// king-side
		if (to.row === 0 && to.col === 4) {
			board[0][7] = board[0][5];
			board[0][5] = null;
			moved.blackKing = false;
			moved.blackRookH = false;
		}
	}
	if (piece.type === "king" && from.row === 0 && from.col === 2) {
			// queen-side
		if (to.row === 0 && to.col === 4) {
			board[0][0] = board[0][3];
			board[0][3] = null;
			moved.blackKing = false;
			moved.blackRookA = false;
		}
	}
}

function promotePawn(row, col) {
    const piece = board[row][col];

    if (!piece || piece.type !== "pawn") return;

    const reachedEnd = ((piece.color === "white" && row === 0) || (piece.color === "black" && row === 7));
	
    if (!reachedEnd) return;

    let choice = prompt("Promote to: queen, rook, bishop, knight", "queen");

    choice = (choice || "queen").toLowerCase();

    const allowed = [
        "queen",
        "rook",
        "bishop",
        "knight"
    ];

    if (!allowed.includes(choice)) {
        choice = "queen";
    }

    board[row][col] = {
        type: choice,
        color: piece.color,
		nick: piece.color === "white" ? choice[0].toUpperCase() : choice[0].toLowerCase()
    };
}

function enPassant(piece, from, to) {
	let dir = piece.color === "white" ? -1 : 1;
	
	if (piece.type === "pawn" && 
		moveHistory[moveHistory.length - 1].capturedPiece === null &&
		board[to.row - dir][to.col] &&
		board[to.row - dir][to.col].type === "pawn" &&
		piece.color !== board[to.row - dir][to.col].color 
	) {
		moveHistory[moveHistory.length - 1].capturedPiece = board[to.row - dir][to.col];
		moveHistory[moveHistory.length - 1].enpassanting = true;
		board[to.row - dir][to.col] = null;
	}
}

function StartTheGame() {
	const mode = prompt("Choose game mode:\n1 = Human vs Human\n2 = Human vs Computer", "2");

	if (mode === "1") {
		gameMode = "human";
	} else {
		gameMode = "computer";

		const color = prompt("Choose your color:\nW = White\nB = Black", "W");

		if (color && color.toUpperCase() === "B") {
			PCColor = "white";
		} else {
			PCColor = "black";
		}
	}
}
