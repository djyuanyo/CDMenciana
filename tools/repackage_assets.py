"""Update the WebView assets and version of a previously compiled native shell.
The input must use the same unchanged Java code, resources and Firebase config.
The output is unsigned; align and sign with the original app certificate.
"""
import argparse, struct, zipfile
from pathlib import Path

def update_manifest(raw, version_name, version_code):
    data=bytearray(raw);strings=[];offset=8;changed_code=False;changed_name=False
    while offset<len(data):
        kind,header,size=struct.unpack_from('<HHI',data,offset)
        if kind==1:
            count,styles,flags,start,style_start=struct.unpack_from('<5I',data,offset+8)
            for index in range(count):
                position=offset+start+struct.unpack_from('<I',data,offset+header+4*index)[0]
                if flags&0x100:
                    def length(pos):
                        n=data[pos];return (((n&0x7f)<<8)|data[pos+1],pos+2) if n&0x80 else (n,pos+1)
                    chars,position=length(position);length_bytes,position=length(position)
                    value=bytes(data[position:position+length_bytes]).decode('utf8')
                    encoded=version_name.encode('utf8')
                else:
                    chars=struct.unpack_from('<H',data,position)[0];position+=2
                    if chars&0x8000:chars=((chars&0x7fff)<<16)|struct.unpack_from('<H',data,position)[0];position+=2
                    length_bytes=chars*2;value=bytes(data[position:position+length_bytes]).decode('utf-16le');encoded=version_name.encode('utf-16le')
                strings.append(value)
                if value=='0.21.0':
                    if len(encoded)!=length_bytes:raise ValueError('Version name must keep the original encoded length')
                    data[position:position+length_bytes]=encoded;changed_name=True
        elif kind==0x102:
            attribute_start,attribute_size,attribute_count=struct.unpack_from('<HHH',data,offset+24)
            for index in range(attribute_count):
                attr=offset+16+attribute_start+index*attribute_size
                name_index=struct.unpack_from('<I',data,attr+4)[0]
                if strings[name_index]=='versionCode':
                    assert data[attr+15]==0x10, 'Expected integer versionCode'
                    struct.pack_into('<I',data,attr+16,version_code);changed_code=True
        offset+=size
    assert changed_name and changed_code, 'Missing version fields'
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');parser.add_argument('--assets',required=True);parser.add_argument('--version',required=True);parser.add_argument('--code',required=True,type=int);args=parser.parse_args()
    assets=Path(args.assets)
    with zipfile.ZipFile(args.input) as source,zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED) as output:
        for item in source.infolist():
            if item.filename.startswith(('META-INF/','assets/')):continue
            raw=source.read(item.filename)
            if item.filename=='AndroidManifest.xml':raw=update_manifest(raw,args.version,args.code)
            output.writestr(item,raw)
        for path in sorted(assets.rglob('*')):
            if path.is_file():output.write(path,'assets/'+str(path.relative_to(assets)))
