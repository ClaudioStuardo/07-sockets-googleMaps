import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Lugar } from '../interfaces/lugar';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../services/websocket.service';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements OnInit {

  @ViewChild('map', { static: true }) mapaElement: ElementRef;
  map: google.maps.Map;

  marcadores: google.maps.Marker[] = [];
  infoWindows: google.maps.InfoWindow[] = [];

  lugares: Lugar[] = [];

  constructor(
    private http: HttpClient,
    public wsService: WebsocketService
  ) { }

  ngOnInit() {
    this.http.get('http://localhost:3000/mapa-google').subscribe( (lugares: Lugar[]) => {
      this.lugares = lugares;
      this.cargarMapa();
    });
    this.escucharSockets();
  }

  escucharSockets() {

    // marcador-nuevo-google
    this.wsService.listen('marcador-nuevo-google').subscribe( (marcador: Lugar) => {
      this.agregarMarcador(marcador);
    });

    // marcador-mover-google
    this.wsService.listen('marcador-mover-google').subscribe( (marcador: Lugar) => {
      for ( const i in this.marcadores ) {
        if ( this.marcadores[i].getTitle() === marcador.id ) {
          const latLng = new google.maps.LatLng( marcador.lat, marcador.lng );
          this.marcadores[i].setPosition( latLng );
          break;
        }
      }
    });

    // marcador-borrar-google
    this.wsService.listen('marcador-borrar-google').subscribe( (id: string) => {
      this.marcadores.find(marker => marker.getTitle() === id).setMap(null);
    });

  }

  cargarMapa() {

    const latLng = new google.maps.LatLng( -33.60960286549905, -70.57588927393569 );
    const mapaOpciones: google.maps.MapOptions = {
      center: latLng,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    this.map = new google.maps.Map( this.mapaElement.nativeElement, mapaOpciones );

    this.map.addListener('click', (coors: any) => {
      const nuevoMarcador: Lugar = {
        nombre: 'sin-nombre',
        lat: coors.latLng.lat(),
        lng: coors.latLng.lng(),
        id: new Date().toISOString()
      };

      this.agregarMarcador( nuevoMarcador );

      // Emitir evento de socket, agregar un nuevo marcador
      this.wsService.emit( 'marcador-nuevo-google', nuevoMarcador );

    });

    for ( const lugar of this.lugares) {
      this.agregarMarcador( lugar );
    }

  }

  agregarMarcador( marcador: Lugar ) {

    const latLng = new google.maps.LatLng( marcador.lat, marcador.lng );

    const marker = new google.maps.Marker({
      map: this.map,
      animation: google.maps.Animation.DROP,
      position: latLng,
      draggable: true,
      title: marcador.id
    });

    this.marcadores.push( marker );

    const contenido = `<b>${ marcador.nombre }</b>`;
    const infoWindow = new google.maps.InfoWindow({
      content: contenido
    });

    this.infoWindows.push( infoWindow );

    google.maps.event.addDomListener( marker, 'click', () => {
      this.infoWindows.forEach( infoW => infoW.close() );
      infoWindow.open( this.map, marker );
    });

    google.maps.event.addDomListener( marker, 'dblclick', (coors) => {
      marker.setMap( null );
      // Dispara un evento de socket para borrar el marcador
      this.wsService.emit( 'marcador-borrar-google', marcador.id );
    });

    google.maps.event.addDomListener( marker, 'drag', (coors: any) => {
      const nuevoMarcador = {
        lat: coors.latLng.lat(),
        lng: coors.latLng.lng(),
        nombre: marcador.nombre,
        id: marcador.id
      };
      // Dispara un evento de socket para mover el marcador
      this.wsService.emit('marcador-mover-google', nuevoMarcador);
    });

  }

}
