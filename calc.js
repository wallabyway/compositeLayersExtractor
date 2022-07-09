//calc.js

alllayers=[];json.allinstances.map(urn=>{urn.results.map(res=>{res.Layers.map(layer=>{alllayers.push(layer)})})})


counts={}; alllayers.forEach(function (x) { counts[x.function+"/"+x.material] = (counts[x.function+"/"+x.material] || 0) + x.width; });
total=arr.reduce((a,b) => a+b,0)

Object.keys(counts).map(item=> counts[item]={value:counts[item], percentage:100.0*counts[item]/total})

Material_Histogram = {
	"Structure/Concrete - Precast Concrete - 35 MPa":
		{"value":5.2493438320209975,"percentage":9.55223880597015},
	"Structure/Concrete - 190mm Concrete Blocks - 20MPa Infill":{"value":6.2335958005249354,"percentage":11.343283582089555},
	"Structure/Concrete - Rough":{"value":1.3123359580052494,"percentage":2.3880597014925375},
	"Membrane/DPM - Damp Proofing Membrane":{"value":0,"percentage":0},
	"Substrate/Compacted Hardfill":{"value":1.968503937007874,"percentage":3.582089552238806},
	"Structure/Plywood, Sheathing":{"value":0.2887139107611548,"percentage":0.5253731343283582},
	"Structure/Concrete - Cast-in-Place Concrete":{"value":0.984251968503937,"percentage":1.791044776119403},"Insulation/Rigid insulation":{"value":1.8372703412073488,"percentage":3.343283582089552},"Structure/Concrete, Cast In Situ":{"value":11.811023622047244,"percentage":21.492537313432837},"Structure/":{"value":1.7716535433070864,"percentage":3.223880597014925},"Structure/Concrete - Pre Cast":{"value":0.5249343832020997,"percentage":0.955223880597015},"Insulation/":{"value":0.07874015748031496,"percentage":0.14328358208955225},"Finish2/Concrete - Pre Cast":{"value":0.7874015748031495,"percentage":1.4328358208955223},"Finish1/Finishes - Exterior - Timber Cladding":{"value":0.7480314960629921,"percentage":1.3611940298507463},"Substrate/Plywood, Sheathing":{"value":0.8661417322834645,"percentage":1.5761194029850745},"Structure/Softwood, Lumber":{"value":3.5433070866141723,"percentage":6.44776119402985},"Finish2/Finishes - Interior - Plasterboard":{"value":0.4429133858267715,"percentage":0.8059701492537311},"Finish2/Finishes - Exterior - Timber Cladding":{"value":0.1476377952755905,"percentage":0.2686567164179104},"Finish1/Finishes - Interior - Gypsum Wall Board":{"value":1.5748031496062984,"percentage":2.8656716417910437},"Substrate/Wood - Stud Layer":{"value":4.724409448818898,"percentage":8.597014925373136},"Structure/Concrete - Cast In Situ":{"value":9.84251968503937,"percentage":17.910447761194032},"Finish1/Chrome-Kohler-CP-Polished_Chrome":{"value":0.01968503937007874,"percentage":0.03582089552238806},"Structure/Wood - Stud Layer":{"value":0.19685039370078738,"percentage":0.3582089552238806}}

