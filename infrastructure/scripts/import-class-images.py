"""Import user-supplied class portraits; bounded ZIP reads, exact aliases, no arbitrary paths."""
import argparse,hashlib,io,json,re,unicodedata,zipfile
from pathlib import Path,PurePosixPath
from PIL import Image,ImageOps

ALIASES={1:['feca'],2:['osamodas'],3:['enutrof'],4:['sram'],5:['xelor'],6:['ecaflip'],7:['eniripsa'],8:['iop'],9:['cra'],10:['sadida'],11:['sacrier','sacrieur','sacri'],12:['pandawa'],13:['halsabschneider','roublard','rogue'],14:['maskarador','zobal','masqueraider'],15:['steamer','foggernaut'],16:['eliotrope'],17:['ubermagier','huppermage'],18:['ouginak'],20:['forgelance']}
def normalized(s):return ''.join(c for c in unicodedata.normalize('NFKD',s.lower())if not unicodedata.combining(c))
def import_images(source,root):
    output=root/'apps/desktop/public/classes';originals=root/'design/class-images/originals'
    output.mkdir(parents=True,exist_ok=True);originals.mkdir(parents=True,exist_ok=True)
    mapping={alias:id for id,names in ALIASES.items()for alias in names};seen=set();hashes=set();report=[]
    with zipfile.ZipFile(source)as archive:
        if sum(m.file_size for m in archive.infolist())>50_000_000:raise ValueError('ZIP uncompressed size limit')
        for member in archive.infolist():
            if member.is_dir():continue
            path=PurePosixPath(member.filename.replace('\\','/'))
            if path.is_absolute()or'..'in path.parts or':'in str(path)or member.file_size>10_000_000:raise ValueError('Unsafe ZIP member')
            cid=mapping.get(normalized(path.stem))
            if cid is None:raise ValueError('Class filename not mapped: '+path.name)
            if cid in seen:raise ValueError('Duplicate class identity')
            raw=archive.read(member);digest=hashlib.sha256(raw).hexdigest()
            if digest in hashes:raise ValueError('Duplicate image payload')
            image=Image.open(io.BytesIO(raw))
            if image.format not in('JPEG','PNG','WEBP'):raise ValueError('Unsupported raster format')
            if image.width*image.height>40_000_000:raise ValueError('Image dimension limit')
            image.verify();image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
            extension={'.jpeg':'.jpg'}.get(path.suffix.lower(),path.suffix.lower())
            if extension not in('.png','.jpg','.webp'):raise ValueError('Extension does not match a supported image')
            (originals/(str(cid)+extension)).write_bytes(raw)
            ImageOps.contain(image,(512,640)).save(output/(str(cid)+'.webp'),'WEBP',quality=90)
            ImageOps.contain(image,(96,120)).save(output/(str(cid)+'-thumb.webp'),'WEBP',quality=85)
            seen.add(cid);hashes.add(digest);report.append({'classId':cid,'file':path.name,'sha256':digest,'size':[image.width,image.height],'asset':f'/classes/{cid}.webp'})
    missing=sorted(set(ALIASES)-seen)
    result={'classes':report,'missing':missing,'duplicates':[]}
    (root/'design/class-images/import-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    if missing:raise ValueError('Missing class IDs: '+','.join(map(str,missing)))
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('zip');args=parser.parse_args()
    result=import_images(args.zip,Path(__file__).resolve().parents[2]);print('Validated class portraits:',len(result['classes']))
