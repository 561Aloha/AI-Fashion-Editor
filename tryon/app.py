import sys
sys.path.append("./IDM-VTON")

from gradio_demo.app import Tryon  # or whatever object they expose

Tryon.queue().launch()
