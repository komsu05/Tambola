export type Ticket = (number | null)[][];

export class TicketGenerator {
  public static generateSetOf6(): Ticket[] {
    // We will use a reliable backtrack/retry approach for the distribution
    let tickets: Ticket[] = [];
    let success = false;
    
    while (!success) {
      try {
        tickets = this.tryGenerateSet();
        success = true;
      } catch (e) {
        // Retry if we hit a constraint dead-end
      }
    }
    return tickets;
  }

  private static tryGenerateSet(): Ticket[] {
    const cols: number[][] = [
      Array.from({length: 9}, (_, i) => i + 1),         // 1-9
      Array.from({length: 10}, (_, i) => i + 10),       // 10-19
      Array.from({length: 10}, (_, i) => i + 20),       // 20-29
      Array.from({length: 10}, (_, i) => i + 30),       // 30-39
      Array.from({length: 10}, (_, i) => i + 40),       // 40-49
      Array.from({length: 10}, (_, i) => i + 50),       // 50-59
      Array.from({length: 10}, (_, i) => i + 60),       // 60-69
      Array.from({length: 10}, (_, i) => i + 70),       // 70-79
      Array.from({length: 11}, (_, i) => i + 80),       // 80-90
    ];

    // Shuffle each column
    cols.forEach(col => col.sort(() => Math.random() - 0.5));

    // Initialize 6 tickets with empty columns
    const ticketCols: number[][][] = Array.from({length: 6}, () => 
      Array.from({length: 9}, () => [])
    );

    // Pass 1: Give every ticket 1 number from every column
    for (let c = 0; c < 9; c++) {
      for (let t = 0; t < 6; t++) {
        ticketCols[t][c].push(cols[c].pop()!);
      }
    }

    // Pass 2: Distribute remaining 36 numbers
    // Each ticket needs exactly 15 numbers total (currently 9, needs 6 more)
    const neededPerTicket = [6, 6, 6, 6, 6, 6];
    
    for (let c = 0; c < 9; c++) {
      while (cols[c].length > 0) {
        // Find valid tickets that can accept a number in this column
        // A ticket is valid if it needs more numbers, AND has < 3 numbers in this column
        const validTickets = [0, 1, 2, 3, 4, 5].filter(t => neededPerTicket[t] > 0 && ticketCols[t][c].length < 3);
        
        if (validTickets.length === 0) {
          throw new Error('Dead end in distribution');
        }
        
        // Pick random valid ticket
        const t = validTickets[Math.floor(Math.random() * validTickets.length)];
        ticketCols[t][c].push(cols[c].pop()!);
        neededPerTicket[t]--;
      }
    }

    // Pass 3: Sort columns and place into rows
    // For each ticket, we must place exactly 5 numbers per row.
    const finalTickets: Ticket[] = [];
    
    for (let t = 0; t < 6; t++) {
      // Sort numbers in each column descending (so we can pop them to put in lower rows)
      ticketCols[t].forEach(col => col.sort((a, b) => b - a));

      const ticketObj = this.arrangeTicketRows(ticketCols[t]);
      finalTickets.push(ticketObj);
    }

    return finalTickets;
  }

  private static arrangeTicketRows(cols: number[][]): Ticket {
    let success = false;
    let ticket: Ticket = [];
    
    // We try until we find a valid row arrangement
    let attempts = 0;
    while (!success && attempts < 100) {
      attempts++;
      ticket = [
        Array(9).fill(null),
        Array(9).fill(null),
        Array(9).fill(null)
      ];
      
      const colLengths = cols.map(c => c.length);
      const rowCounts = [0, 0, 0];
      
      // Place column elements randomly into rows
      let valid = true;
      for (let c = 0; c < 9; c++) {
        let placed = 0;
        const availableRows = [0, 1, 2].sort(() => Math.random() - 0.5);
        
        for (const row of availableRows) {
          if (rowCounts[row] < 5 && placed < colLengths[c]) {
            ticket[row][c] = true as any; // Temporary marker
            rowCounts[row]++;
            placed++;
          }
        }
        
        if (placed < colLengths[c]) {
          valid = false;
          break;
        }
      }
      
      if (valid && rowCounts.every(r => r === 5)) {
        success = true;
        // Replace markers with actual sorted numbers
        for (let c = 0; c < 9; c++) {
          const numbers = [...cols[c]].sort((a, b) => a - b);
          for (let r = 0; r < 3; r++) {
            if (ticket[r][c]) {
              ticket[r][c] = numbers.shift()!;
            }
          }
        }
      }
    }

    if (!success) throw new Error('Failed to arrange rows');
    
    return ticket;
  }
}
