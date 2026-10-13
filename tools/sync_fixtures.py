"""Shared HTML parsing helpers and the entry point for the public RFAF sync."""
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class Node:
    def __init__(self,tag='',attrs=None): self.tag=tag;self.attrs=dict(attrs or []);self.children=[];self.parts=[];self.content=[]
    def text(self): return ' '.join(' '.join(self.parts).split())
    def find(self,tag=None,cls=None):
        result=[]
        for child in self.children:
            if (tag is None or child.tag==tag) and (cls is None or cls in child.attrs.get('class','').split()):result.append(child)
            result.extend(child.find(tag,cls))
        return result
class Document(HTMLParser):
    def __init__(self,html):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(html)
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs);self.stack[-1].children.append(node);self.stack[-1].content.append(node)
        if tag not in ('img','input','meta','link','br','hr','source','area','wbr','embed'):self.stack.append(node)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];break
    def handle_data(self,text):
        self.stack[-1].content.append(text)
        for n in self.stack:n.parts.append(text)

def normalize(name):return ''.join(c for c in unicodedata.normalize('NFKD',name.upper()) if not unicodedata.combining(c))
def is_club(name):return 'APAGA Y VAMONOS' in normalize(name) or 'C.D. MENCIANA' in normalize(name)
if __name__=='__main__':
    import sys
    from official_rfaf import sync_all as official_sync
    official_sync(with_profiles='--results-only' not in sys.argv)
