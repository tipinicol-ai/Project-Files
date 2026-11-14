from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).parent
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font_b='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def make(path,size,sidebar=False):
    w,h=size
    im=Image.new('RGB',(w,h),(13,25,42)); d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/max(1,h-1); c=(int(19+10*t),int(57+70*t),int(88+90*t)); d.line((0,y,w,y),fill=c)
    for x,y,r,c in [(w*.75,h*.18,h*.35,(35,151,190)),(w*.18,h*.82,h*.28,(36,102,174)),(w*.9,h*.88,h*.22,(76,207,165))]:
        d.ellipse((x-r,y-r,x+r,y+r),fill=c)
    overlay=Image.new('RGBA',(w,h),(0,0,0,0)); od=ImageDraw.Draw(overlay)
    od.ellipse((w*.58,-h*.05,w*1.2,h*.55),fill=(100,230,246,45)); od.ellipse((-w*.2,h*.6,w*.4,h*1.25),fill=(42,117,232,60))
    im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB'); d=ImageDraw.Draw(im)
    if sidebar:
        d.rounded_rectangle((28,36,136,144),radius=22,fill=(23,139,180),outline=(145,242,253),width=3)
        d.rectangle((49,70,115,116),fill=(179,245,251)); d.rounded_rectangle((43,56,121,81),radius=8,fill=(129,228,240)); d.ellipse((73,87,91,105),fill=(33,125,164))
        d.text((25,174),'PROJECT',font=ImageFont.truetype(font_b,18),fill=(226,249,255)); d.text((25,198),'FILES',font=ImageFont.truetype(font_b,18),fill=(116,232,242)); d.text((25,248),'Desarrollado por',font=ImageFont.truetype(font,10),fill=(170,205,222)); d.text((25,264),'Bryan Castellano',font=ImageFont.truetype(font_b,11),fill=(242,251,255))
    else:
        d.text((22,18),'Project Files',font=ImageFont.truetype(font_b,16),fill=(224,248,255)); d.text((155,20),'Administrador de archivos para Windows',font=ImageFont.truetype(font,11),fill=(170,207,224))
    im.save(path)
make(root/'installer-sidebar.bmp',(164,314),True)
make(root/'installer-header.bmp',(493,58),False)
