// Make TypeScript aware of the 'google' global variable
declare global {
  interface Window {
    google: {
      maps: {
        importLibrary: (library: string) => Promise<any>;
        places: {
          PlaceAutocompleteElement: new () => HTMLElement;
          Autocomplete: new (input: HTMLInputElement, options?: any) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => {
              formatted_address?: string;
              geometry?: {
                location: {
                  lat: () => number;
                  lng: () => number;
                }
              };
              viewport?: any;
            };
          };
        };
        ControlPosition: {
          TOP_LEFT: number;
        };
        Map: any;
        marker: {
          AdvancedMarkerElement: any;
        };
        InfoWindow: any;
      };
    };
  }
}

// Extend the global namespace
declare namespace google.maps {
  interface PlacesLibrary {
    PlaceAutocompleteElement: any;
    Autocomplete: any;
  }
}

// Add type definition for Google Maps API
interface Window {
  google: any;
} 