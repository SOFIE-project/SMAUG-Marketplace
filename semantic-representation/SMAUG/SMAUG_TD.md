# TD in SMAUG

Following is the TD file returned by the marketplace backend when a mobile client discovers a smart locker nearby and dereferences the URL advertised in the iBeacon advertising packet by the smart locker. This file is a union of a template part, which constitutes 99% of the information, and a locker-specific part, which is added when the locker is registered at the marketplace backend.

## SMAUG TD template

The field `properties.lockerDetails.href` is added to the template for a given smart locker when the smart locker data has been saved on the backend, and the relative API endpoint is created. Apart from that, the rest of the TD stays the same regardless of the locker. It is only used as the entry point to then fetch additional information about the locker, from the given endpoint specified in `properties.lockerDetails.href`.

```JSON
{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type@": "SMAUGTemplate",
    "title": "SMAUG Smart Locker Thing Description",
    "version": "1.0",
    "properties": {
        "lockerDetails": {
            "title": "Smart locker details",
            "description": "Endpoint from which it is possible to retrieve details about the smart locker.",
            "forms": [
                {
                    "op": "readallproperties",
                    "security": "open_access",
                    "response": {
                        "contentType": "application/json"
                    }
                }
            ],
            "readonly": "true"
        }
    },
    "links": {},
    "forms": {},
    "security": [],
    "securityDefinitions": {
        "open_access": {
            "scheme": "nosec",
            "description": "Access not restricted to anyone.",
            "proxy": "https://smaug.sofie-iot.eu"
        }
    }
}
```

## SMAUG JSON schema for smart locker details

This is enforced when a smart locker owner tries to register a new smart locker.

```JSON
{
    "$schema": "http://json-schema.org/draft-07/schema",
    "$id": "https://smaug.sofie-iot.eu/schema.json",
    "type": "object",
    "title": "SMAUG smart locker schema",
    "description": "JSON schema to validate SMAUG smart locker details.",
    "properties": {
        "name": {
            "$id": "#/properties/name",
            "title": "Locker name",
            "description": "Locker short name.",
            "type": "string",
        },
        "description": {
            "$id": "#/properties/descriptions",
            "title": "Locker description",
            "description": "Locker longer textual description.",
            "type": "string",
        },
        "location": {
            "$id": "#/properties/location",
            "title": "Locker location",
            "description": "Locker GPS coordinates.",
            "type": "object",
            "properties": {
                "lat": {
                    "$id": "#/properties/location/properties/lat",
                    "title": "Locker latitude",
                    "type": "number",
                    "minimum": -90,
                    "maximum": 90
                },
                "lon": {
                    "$id": "#/properties/location/properties/lon",
                    "title": "Locker longitude",
                    "type": "number",
                    "minimum": -180,
                    "maximum": 180
                }
            },
            "required": ["lat", "lon"]
        },
        "icon_image": {
            "$id": "#/properties/icon_image",
            "title": "Locker icon image",
            "description": "Locker main image, either as binary or as a URL (only HTTPS supported).",
            "anyOf": [
                {
                    "type": "string"
                },
                {
                    "type": "string",
                    "pattern": "https:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)"
                }
            ]
        },
        "additional_images": {
            "$id": "#/properties/additional_images",
            "title": "Locker additional images",
            "description": "Locker additional images, either as binary or as a URL (only HTTPS supported).",
            "type": "array",
            "items": {
                "$id": "#/properties/additional_images/items",
                "anyOf": [
                    {
                        "type": "string"
                    },
                    {
                        "type": "string",
                        "pattern": "https:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)"
                    }
                ]
            }
        },
        "lock_mechanism": {
            "$id": "#/properties/lock_mechanism",
            "title": "Locker locking mechanism",
            "description": "Locker locking mechanism, i.e., how does the locker gets locked? Push to close, push to close after delay, tap to close, etc...",
            "type": "string",
            "oneOf": [
                {
                    "const": "push-to-lock",
                    "description": "The locker must be pushed to get locked."
                },
                {
                    "const": "push-to-lock-after-delay",
                    "description": "The locker must be pushed and, if not opened again, it gets locked after a delay."
                },
                {
                    "const": "tap-to-lock",
                    "description": "The locker needs to be manually locked once it has been closed."
                }
            ]
        }
    }
}
```

```JSON
{
    "name": "Test name",
    "description": "Locker description",
    "owner": "Owner name",
    "location": {
        "lat": 10,
        "lon": 10
    },
    "icon_image": "https://example.com/a.jpg",
    "auxiliary_images": [
        "https://example.com/b.jpg",
        "https://example.com/c.jpg"
    ],
    "lock_mechanism": "push-to-close"
}
```