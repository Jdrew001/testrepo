export const parseStyles = (style: string) => {
    const styles: {[prop: string]: string} = {};
    if (!style) return;
    
    style = style.trim().replace(/;$/, '');
    const styleDeclarations: string[] = style.split(';').map(decl => decl.trim());
    
    styleDeclarations.forEach(decl => {
      if (!decl || decl.indexOf(':') === -1) return;
      
      const colonIndex: number = decl.indexOf(':');
      const prop: string = decl.substring(0, colonIndex).trim();
      const value: string = decl.substring(colonIndex + 1).trim();
      
      if (prop && value) styles[prop] = value;
    });
    
    return styles;
  }