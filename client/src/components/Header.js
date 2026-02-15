import React from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { BsCameraVideo } from 'react-icons/bs';

const Header = () => {
  const navigate = useNavigate();

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <BsCameraVideo className="me-2" />
          FrigateSimpleUI Setup
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
          </Nav>
          <Button 
            variant="success" 
            onClick={() => navigate('/add-camera')}
          >
            Add Camera
          </Button>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header; 