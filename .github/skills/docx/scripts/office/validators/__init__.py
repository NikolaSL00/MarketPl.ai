"""Office XML validators package.

This file exists so the CLI tools in `scripts/office/` can import
`DOCXSchemaValidator`, `PPTXSchemaValidator`, and `RedliningValidator` via:

    from validators import DOCXSchemaValidator, PPTXSchemaValidator, RedliningValidator
"""

from .docx import DOCXSchemaValidator
from .pptx import PPTXSchemaValidator
from .redlining import RedliningValidator
