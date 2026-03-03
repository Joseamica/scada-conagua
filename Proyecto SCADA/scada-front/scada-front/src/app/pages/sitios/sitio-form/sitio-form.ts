import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';

const estadosJson = require('../../../../assets/data/estados.json');

interface EstadoMunicipio {

  estado: string;
  municipios: string[];

}

@Component({
  standalone: true,
  selector: 'app-sitio-form',
  imports: [
    ReactiveFormsModule,  
    HeaderBarComponent,
    FooterTabsComponent,
    CommonModule
], 
  templateUrl: './sitio-form.html',
  styleUrls: ['./sitio-form.css']
})
export class SitioForm implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  modo: 'create' | 'edit' = 'create';
  sitioId: string | null = null;

  tiposSitio = [
  { value:'pozo', label:'Pozo' },
  { value:'pluviometro', label:'Pluviómetro' },
  { value:'drenaje', label:'Drenaje' },
  { value:'agua_bloque', label:'Agua en bloque' },
  { value:'estanque', label:'Estanque' }
];

estatusSitio = [

  { value:'activo', label:'Activo' },
  { value:'obra', label:'En obra' },
  { value:'inactivo', label:'Inactivo' }

];

estados: EstadoMunicipio[] = [];
municipiosFiltrados:string[] = [];

proveedores = [

  { id:1, nombre:'4PT' },
  { id:2, nombre:'ICH' }

];


 form = this.fb.group({

  nombre:[''],

  tipo:['pozo'],

  estatus:['activo'],

  estado:[''],
  municipio:[''],

  proveedor:[null],

  gatewayId:[''],
  utrId:[''],

  lat:[0],
  lng:[0],

  render:['']

});


  ngOnInit() {

 const data: unknown = estadosJson;

  // 2. Verificamos si es el formato de módulo { default: [...] } o el objeto directo
  const baseData = (data as { default: any }).default || data;

  // 3. Convertimos a Array y asignamos
  this.estados = Object.values(baseData) as EstadoMunicipio[];

  console.log('Estados listos:', this.estados);

  // 3. Tu lógica de suscripción se mantiene igual
  this.form.get('estado')?.valueChanges.subscribe(estadoNombre => {
  const encontrado = this.estados.find(e => e.estado === estadoNombre);
  
  if (encontrado && encontrado.municipios) {
    // CONVERSIÓN CRÍTICA: Convertimos el objeto de municipios en un Array
    this.municipiosFiltrados = Object.values(encontrado.municipios);
  } else {
    this.municipiosFiltrados = [];
  }

  // Limpiamos el valor del municipio en el formulario
  this.form.get('municipio')?.setValue('');
});

    // detectar si viene edición
    this.sitioId = this.route.snapshot.paramMap.get('id');

    if (this.sitioId) {
      this.modo = 'edit';
      this.loadSitio();
    }

    // detectar si viene desde GIS
    const qp = this.route.snapshot.queryParams;

    if (qp['lat']) {
      this.form.patchValue({
        lat: qp['lat'],
        lng: qp['lng']
      });
    }

  }


  loadSitio() {

    // aquí luego cargas desde store o API
    console.log('cargar sitio', this.sitioId);

  }

  save() {

    if (this.form.invalid) return;

    if (this.modo === 'create') {

      console.log('crear sitio', this.form.value);

    } else {

      console.log('editar sitio', this.form.value);

    }

    this.router.navigate(['/telemetria']);

  }

  onRenderSelected(event:any){

  const file = event.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = () => {

   this.form.patchValue({
  render: reader.result as string
});

  };

  reader.readAsDataURL(file);

}

cancelar(){

  this.router.navigate(['/telemetria']);

}





}
