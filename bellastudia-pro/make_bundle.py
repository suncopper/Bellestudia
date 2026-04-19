import os
import base64

def make_bundle():
    try:
        # Load local files
        with open('index.html', 'r', encoding='utf-8') as f:
            html = f.read()
        
        with open('css/style.css', 'r', encoding='utf-8') as f:
            css = f.read()
            
        with open('js/app.js', 'r', encoding='utf-8') as f:
            js = f.read()
            
        with open('assets/logo.png', 'rb') as f:
            logo_b64 = base64.b64encode(f.read()).decode()

        # Construction
        logo_data_uri = f'data:image/png;base64,{logo_b64}'
        
        # 1. Inline CSS (Direct string replace)
        css_tag = '<link rel="stylesheet" href="css/style.css">'
        html = html.replace(css_tag, f'<style>\n{css}\n</style>')
        
        # 2. Inline JS (Direct string replace)
        js_tag = '<script src="js/app.js"></script>'
        html = html.replace(js_tag, f'<script>\n{js}\n</script>')
        
        # 3. Replace images
        html = html.replace('assets/logo.png', logo_data_uri)
        
        # 4. Remove the helper button
        if '<button id="btn-download-portable"' in html:
            start_tag = '<button id="btn-download-portable"'
            end_tag = '</button>'
            before = html.split(start_tag)[0]
            after = html.split(start_tag)[1].split(end_tag, 1)[1]
            html = before + after

        with open('BellestudiaPro_Portable.html', 'w', encoding='utf-8') as f:
            f.write(html)
            
        print("Bundle created: BellestudiaPro_Portable.html")
    except Exception as e:
        import traceback
        print(f"Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    make_bundle()
