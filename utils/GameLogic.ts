export class TambolaEngine {
  private allNumbers: number[] = Array.from({ length: 90 }, (_, i) => i + 1);
  private drawnNumbers: number[] = [];
  
  public getDrawnNumbers() {
    return this.drawnNumbers;
  }
  
  public drawNextNumber(): number | null {
    const available = this.allNumbers.filter(n => !this.drawnNumbers.includes(n));
    if (available.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * available.length);
    const drawn = available[randomIndex];
    this.drawnNumbers.push(drawn);
    return drawn;
  }
  
  public reset() {
    this.drawnNumbers = [];
  }
}

export class TambolaValidator {
  public static verifyPattern(ticket: (number | null)[][], drawnNumbers: number[], pattern: string): boolean {
    let matched = 0;
    
    switch (pattern) {
      case 'Early 5':
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 9; c++) {
            const val = ticket[r][c];
            if (val !== null && drawnNumbers.includes(val)) matched++;
          }
        }
        return matched >= 5;

      case 'Top Row':
        return this.verifyRow(ticket, drawnNumbers, 0);

      case 'Middle Row':
        return this.verifyRow(ticket, drawnNumbers, 1);
        
      case 'Bottom Row':
        return this.verifyRow(ticket, drawnNumbers, 2);

      case 'Full House':
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 9; c++) {
            const val = ticket[r][c];
            if (val !== null && !drawnNumbers.includes(val)) return false;
          }
        }
        return true;
        
      default:
        return false;
    }
  }

  private static verifyRow(ticket: (number | null)[][], drawnNumbers: number[], rowIndex: number): boolean {
    let matched = 0;
    for (let c = 0; c < 9; c++) {
      const val = ticket[rowIndex][c];
      if (val !== null) {
        if (!drawnNumbers.includes(val)) return false;
        matched++;
      }
    }
    return matched === 5;
  }
}
