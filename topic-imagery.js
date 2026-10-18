const unsplashTopic=(photo,alt,credit,id,position='center')=>({url:`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=80`,alt,credit:credit+' / Unsplash',source:'https://unsplash.com/photos/'+id,position});
const pexelsTopic=(id,alt,source,position='center')=>({url:`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1000`,alt,credit:'Pexels',source,position});
Object.assign(mediaCards,{
 navigation:unsplashTopic('photo-1762855607111-03c4ded459d0','A route plotted with a ruler on an aviation chart','Sweder Breet','bhoquIY2JuY'),
 cabin:unsplashTopic('photo-1774852767820-c260ae3d2e93','Cabin crew trainees inside an aircraft cabin training room','Skytech Aviation','CNw6JE2OYSQ','center 42%'),
 weather:unsplashTopic('photo-1749365960943-b3feccadac65','Dark storm clouds illustrating aviation weather study','Alina','unsyQUWHtqA'),
 canyon:unsplashTopic('photo-1775712910868-eb2455a08fe5','Layered sandstone walls in a desert canyon','Adam Young','2w_3nrKtzOU'),
 maintenance:pexelsTopic('12944268','A maintenance professional inspecting an aircraft engine','https://www.pexels.com/photo/a-man-sitting-under-aircraft-engine-12944268/','center 60%'),
 ground:pexelsTopic('36014685','A ground crew member working beside an aircraft on the apron','https://www.pexels.com/photo/airport-runway-with-ground-crew-directing-aircraft-36014685/','center 55%'),
 coast:pexelsTopic('30302379','An aerial view of a rocky coastline and ocean waves','https://www.pexels.com/photo/aerial-view-of-rocky-coastline-and-ocean-waves-30302379/'),
 islands:pexelsTopic('28859941','A tropical island surrounded by turquoise water','https://www.pexels.com/photo/aerial-view-of-tropical-island-in-maldives-28859941/'),
 highlands:pexelsTopic('34961318','Scottish highland slopes and a loch under clouds','https://www.pexels.com/photo/scenic-view-of-scottish-highlands-landscape-34961318/'),
 twilight:pexelsTopic('3551841','A mountain lake beneath a blue-hour sky','https://www.pexels.com/photo/photo-of-lake-near-mountain-3551841/'),
 engine:{url:'assets/engine-detail.png',alt:'The app’s detailed opposed-cylinder teaching engine',credit:'First Flight · in-app model preview',source:'#sim',position:'55% 91%',preview:true},
 airframe:{url:'assets/trainer-exterior.png',alt:'The app’s high-wing training airplane in the hangar',credit:'First Flight · in-app model preview',source:'#sim',position:'62% 58%',preview:true}
});
cardPhoto=function(key='training'){const m=mediaCards[key]||mediaCards.training;return `<figure class="selection-photo" data-image-topic="${key}"><img src="${m.url}" alt="${m.alt}" style="object-position:${m.position||'center'}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.closest('figure').classList.add('image-unavailable');this.closest('figure').querySelector('figcaption').textContent='${key.replaceAll('-',' ')} · image unavailable'"><figcaption><a href="${m.source}" ${m.preview?'':'target="_blank" rel="noopener"'}>${m.credit}</a>${m.preview?'':' · illustrative photo'}</figcaption></figure>`;};
const topicImageMap={
 'Flight Foundations':'training','Know Your Airplane':'engine','Weather, Terrain & Judgment':'weather','Navigation & Flight Debrief':'navigation',
 'Your first cockpit session':'cockpit','Explore the engine':'engine','A virtual preflight walkthrough':'airframe','Practice a gentle heading change':'navigation','Read the landscape critically':'terrain','A useful post-flight debrief':'navigation',
 'Alpine Lakes':'terrain','Pacific Coast':'coast','Red Rock Canyon':'canyon','Emerald Islands':'islands','Northern Highlands':'highlands','Blue Hour Valley':'twilight',
 'Heritage Hangar':'airframe','Glass & Steel Pavilion':'hangar','Maintenance Workshop':'maintenance','Expedition Outpost':'airframe',
 'A pilot’s foundation':'training','Get a feel for flying':'cockpit','Keep your curiosity flying':'navigation'
};
roleData.forEach(r=>r.image=({pilot:'training',operations:'navigation',maintenance:'maintenance',cabin:'cabin',ground:'ground'})[r.id]);
credentials.forEach(c=>c[4]=({'Student pilot':'training','Private pilot':'airframe','Instrument rating':'cockpit','Commercial pilot':'navigation','ATP / restricted ATP':'cockpit'})[c[0]]);
sampleBanks.pilot.image='airframe';sampleBanks.credentials.image='navigation';sampleBanks.workforce.image='ground';
const imageryStyle=document.createElement('style');imageryStyle.textContent=`.selection-photo.image-unavailable{background:linear-gradient(135deg,#26475b,#152c3c)}.selection-photo[data-image-topic="engine"] img{height:310px;max-width:none;position:absolute;bottom:0;object-fit:cover}.selection-photo[data-image-topic="airframe"] img{height:290px;max-width:none;position:absolute;bottom:-25px;object-fit:cover}.role-tile img{object-fit:cover}.role-tile:nth-child(3) img{object-position:center 65%}.role-tile:nth-child(5) img{object-position:center 55%}`;document.head.append(imageryStyle);

