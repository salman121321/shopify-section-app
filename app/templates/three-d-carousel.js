export const THREE_D_CAROUSEL_LIQUID = `{% schema %}
{
  "name": "3D Carousel Pro",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Featured Products"
    },
    {
      "type": "text",
      "id": "subheading",
      "label": "Subheading",
      "default": "Check out our latest collection"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "Background Color",
      "default": "#a3d5f7"
    },
    {
      "type": "color",
      "id": "heading_color",
      "label": "Heading Color",
      "default": "#1a1a1a"
    },
    {
      "type": "color",
      "id": "subheading_color",
      "label": "Subheading Color",
      "default": "#4a4a4a"
    },
    {
      "type": "range",
      "id": "heading_size",
      "min": 12,
      "max": 60,
      "step": 1,
      "unit": "px",
      "label": "Heading Size",
      "default": 36
    },
    {
      "type": "range",
      "id": "subheading_size",
      "min": 10,
      "max": 40,
      "step": 1,
      "unit": "px",
      "label": "Subheading Size",
      "default": 16
    },
    {
      "type": "color",
      "id": "bg_overlay_color",
      "label": "Overlay Color",
      "default": "#000000"
    },
    {
      "type": "range",
      "id": "bg_overlay_opacity",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "label": "Overlay Opacity",
      "default": 0
    }
  ],
  "presets": [
    {
      "name": "3D Carousel Pro"
    }
  ]
}
{% endschema %}

<div style="background-color: {{ section.settings.background_color }}; position: relative; overflow: hidden; padding: 40px 0;">
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: {{ section.settings.bg_overlay_color }}; opacity: {{ section.settings.bg_overlay_opacity | divided_by: 100.0 }}; pointer-events: none;"></div>
  
  <div style="position: relative; z-index: 2; text-align: center; margin-bottom: 40px;">
    <h2 style="color: {{ section.settings.heading_color }}; font-size: {{ section.settings.heading_size }}px; margin-bottom: 10px;">{{ section.settings.heading }}</h2>
    <p style="color: {{ section.settings.subheading_color }}; font-size: {{ section.settings.subheading_size }}px;">{{ section.settings.subheading }}</p>
  </div>

  <div style="display: flex; justify-content: center; gap: 20px; perspective: 1000px; padding: 20px;">
    {% for i in (1..3) %}
      <div style="width: 250px; height: 350px; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transform: rotateY({% if forloop.index == 1 %}15deg{% elsif forloop.index == 3 %}-15deg{% else %}0deg{% endif %}) scale({% if forloop.index == 2 %}1.05{% else %}0.95{% endif %}); transition: transform 0.3s ease;">
        <div style="height: 60%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 15px 15px 0 0;">
          <span style="font-size: 40px;">📦</span>
        </div>
        <div style="padding: 20px;">
          <div style="height: 10px; width: 80%; background: #ddd; margin-bottom: 10px; border-radius: 5px;"></div>
          <div style="height: 10px; width: 60%; background: #eee; border-radius: 5px;"></div>
        </div>
      </div>
    {% endfor %}
  </div>
</div>`;