export default class PaginationUtils {
    static getPaginationText(start: number, limit: number, totalrows: number): string | undefined {
      if (!totalrows || totalrows === 0) {
        return;
      }
      
      let toPages: number = start + limit;
      toPages = +toPages;
      
      if (toPages > totalrows) {
        toPages = totalrows;
      }
      
      if (totalrows === 0) {
        return 'No Records';
      } else {
        return `${start + 1} to ${toPages} of ${totalrows}`;
      }
    }
  }