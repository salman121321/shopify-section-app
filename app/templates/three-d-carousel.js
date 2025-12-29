export const THREE_D_CAROUSEL_LIQUID = `
{% schema %}
{
  "name": "3D Carousel Pro",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "header",
      "content": "Content"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Featured Products"
    },
    {
      "type": "richtext",
      "id": "subheading",
      "label": "Subheading",
      "default": "<p>Check out our latest collection</p>"
    },
    {
      "type": "collection",
      "id": "collection",
      "label": "Collection"
    },
    {
      "type": "header",
      "content": "Appearance"
    },
    {
      "type": "color",
      "id": "backgroundColor",
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
        "max": 30,
        "step": 1,
        "unit": "px",
        "label": "Subheading Size",
        "default": 16
    }
  ],
  "presets": [
    {
      "name": "3D Carousel Pro"
    }
  ]
}
{% endschema %}

<style>
  .carousel-3d-section {
    position: relative;
    padding: 60px 0;
    overflow: hidden;
    background-color: {{ section.settings.backgroundColor }};
  }
  
  .carousel-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: {{ section.settings.bg_overlay_color }};
    opacity: {{ section.settings.bg_overlay_opacity | divided_by: 100.0 }};
    pointer-events: none;
    z-index: 1;
  }

  .carousel-content {
    position: relative;
    z-index: 2;
    text-align: center;
    margin-bottom: 40px;
  }

  .carousel-heading {
    color: {{ section.settings.heading_color }};
    font-size: {{ section.settings.heading_size }}px;
    margin: 0 0 10px 0;
    font-weight: 700;
  }

  .carousel-subheading {
    color: {{ section.settings.subheading_color }};
    font-size: {{ section.settings.subheading_size }}px;
  }
  
  .carousel-subheading p {
    margin: 0;
  }

  /* 3D Carousel Styles */
  .carousel-container {
    position: relative;
    z-index: 2;
    margin: 0 auto;
    width: 100%;
    max-width: 1200px;
    height: 400px;
    perspective: 1000px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .carousel-spinner {
    display: flex;
    gap: 20px;
    transform-style: preserve-3d;
    transition: transform 0.5s;
  }

  .carousel-item {
    width: 250px;
    height: 350px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.3s, opacity 0.3s;
    cursor: pointer;
  }
  
  .carousel-item:hover {
    transform: translateY(-10px);
  }

  .product-image {
    height: 60%;
    background-color: #f1f1f1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .product-info {
    padding: 20px;
    text-align: left;
  }

  .product-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: #333;
  }

  .product-price {
    color: #666;
  }
  
  /* Mock Items if no collection */
  .mock-item {
     display: flex;
     align-items: center;
     justify-content: center;
     color: #999;
     font-size: 40px;
  }

</style>

<div class="carousel-3d-section">
  <div class="carousel-overlay"></div>
  
  <div class="carousel-content">
    <h2 class="carousel-heading">{{ section.settings.heading }}</h2>
    <div class="carousel-subheading">{{ section.settings.subheading }}</div>
  </div>

  <div class="carousel-container">
     <div class="carousel-spinner">
        {% assign collection = collections[section.settings.collection] %}
        
        {% if collection != blank and collection.products_count > 0 %}
            {% for product in collection.products limit: 5 %}
                <div class="carousel-item">
                    <div class="product-image">
                        <img src="{{ product.featured_image | img_url: '400x' }}" alt="{{ product.title }}">
                    </div>
                    <div class="product-info">
                        <div class="product-title">{{ product.title }}</div>
                        <div class="product-price">{{ product.price | money }}</div>
                    </div>
                </div>
            {% endfor %}
        {% else %}
            <!-- Mock Items -->
            {% for i in (1..3) %}
                <div class="carousel-item">
                    <div class="product-image mock-item">
                        <span>📷</span>
                    </div>
                    <div class="product-info">
                        <div class="product-title">Sample Product {{ i }}</div>
                        <div class="product-price">$99.00</div>
                    </div>
                </div>
            {% endfor %}
        {% endif %}
     </div>
  </div>
</div>

<script>
  // Simple JS to handle 3D rotation or interaction could go here
  // For now we keep it static CSS based or simple layout
  console.log('3D Carousel Loaded');
</script>
`;
